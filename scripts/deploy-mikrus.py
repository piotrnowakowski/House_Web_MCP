"""Deploy a locally validated static build to the existing Mikrus Compose service.

Inputs: --env-file (default .env), --dist (default dist), --revision (Git SHA),
and --deploy to publish; without --deploy only inspect the existing service.
The env file supplies VPS_HOST/PORT/USER/PASSWORD/SSH_HOST_KEY and
HOUSE_DEPLOY_PATH/PROJECT/PUBLIC_PORT/URL. Credentials never enter the archive.
Uses tracked deploy/mikrus Nginx/Docker templates, precompresses text assets, and
retains the immediately preceding release's hashed chunks for open browser tabs.
Requires Paramiko. Output: release archive, remote image, Compose backup and
deployment record. A failed service health check restores the previous Compose.
Usage: python scripts/deploy-mikrus.py --revision <sha> --deploy
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import gzip
import json
import logging
from pathlib import Path, PurePosixPath
import re
import shlex
import tarfile
import time

LOG = logging.getLogger(__name__)


def read_config(path):
    config = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip().strip('"').strip("'")
    required = ["VPS_HOST", "VPS_PORT", "VPS_USER", "VPS_PASSWORD", "VPS_SSH_HOST_KEY",
                "HOUSE_DEPLOY_PATH", "HOUSE_DEPLOY_PROJECT", "HOUSE_DEPLOY_PUBLIC_PORT", "HOUSE_DEPLOY_URL"]
    if any(not config.get(key) for key in required):
        raise ValueError("Deployment configuration is incomplete")
    root = PurePosixPath(config["HOUSE_DEPLOY_PATH"])
    if not root.is_absolute() or ".." in root.parts or len(root.parts) < 4:
        raise ValueError("Expected an absolute application deployment directory")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]+", config["HOUSE_DEPLOY_PROJECT"]):
        raise ValueError("Invalid Compose project name")
    return config


def connect(config):
    import paramiko

    class PinnedKey(paramiko.MissingHostKeyPolicy):
        def missing_host_key(self, client, hostname, key):
            actual = "SHA256:" + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
            expected = config["VPS_SSH_HOST_KEY"].split()
            if expected[0] != key.get_name() or expected[-1] != actual:
                raise paramiko.SSHException("Server key does not match the saved fingerprint")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(PinnedKey())
    client.connect(config["VPS_HOST"], port=int(config["VPS_PORT"]), username=config["VPS_USER"],
                   password=config["VPS_PASSWORD"], look_for_keys=False, allow_agent=False, timeout=20)
    return client


def run(client, command):
    _, stdout, stderr = client.exec_command(command, timeout=180)
    output, error = stdout.read().decode(), stderr.read().decode()
    if stdout.channel.recv_exit_status():
        raise RuntimeError(error or output or "Remote command failed")
    return output


def write_remote(sftp, path, text):
    with sftp.open(path, "w") as target:
        target.write(text)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env"), help="Private deployment configuration")
    parser.add_argument("--dist", type=Path, default=Path("dist"), help="Validated Vite output, built with BASE_PATH=/")
    parser.add_argument("--revision", help="Commit represented by the build")
    parser.add_argument("--deploy", action="store_true", help="Upload, validate a candidate and replace this app service")
    args = parser.parse_args()
    if args.deploy and not re.fullmatch(r"[0-9a-f]{7,40}", args.revision or ""):
        parser.error("--deploy requires a Git SHA in --revision")
    return args


def main() -> None:
    args = parse_args()
    config = read_config(args.env_file)
    remote_dir = config["HOUSE_DEPLOY_PATH"] + "/deploy/mikrus"
    compose_path = remote_dir + "/compose.yaml"
    project = config["HOUSE_DEPLOY_PROJECT"]
    compose = "docker compose -p " + shlex.quote(project) + " -f " + shlex.quote(compose_path)
    with connect(config) as client, client.open_sftp() as sftp:
        current = sftp.open(compose_path).read().decode()
        status = json.loads(run(client, compose + " ps --format json"))
        LOG.info("Current image: %s; state: %s; health: %s", status["Image"], status["State"], status["Health"])
        if not args.deploy:
            return
        if not (args.dist / "index.html").is_file():
            raise ValueError("Build the application before deploying")
        expected_count = len(json.loads((args.dist / "models/interior/manifest.json").read_text())["products"])
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        release = remote_dir + "/releases/" + args.revision
        image = project + ":" + args.revision
        candidate = project + "-candidate-" + args.revision
        new_compose, contexts = re.subn(r"context: \./releases/[^\s]+", "context: ./releases/" + args.revision, current)
        new_compose, images = re.subn(r"image: " + re.escape(project) + r":[^\s]+", "image: " + image, new_compose)
        if contexts != 1 or images != 1:
            raise ValueError("Existing Compose is not the expected single-app release configuration")
        templates = Path(__file__).resolve().parents[1] / "deploy" / "mikrus"
        nginx = (templates / "nginx.conf").read_text(encoding="utf-8")
        if nginx.count("__REVISION__") != 1:
            raise ValueError("Expected one release identifier in the tracked Nginx template")
        nginx = nginx.replace("__REVISION__", args.revision)
        dockerfile = (templates / "Dockerfile").read_text(encoding="utf-8")
        entries = list(args.dist.rglob("*"))
        if any(path.is_symlink() or path.name.startswith(".env") for path in entries):
            raise ValueError("Refusing a build containing symlinks or environment files")
        for path in entries:
            if path.is_file() and path.suffix in {".js", ".css", ".json", ".wasm", ".svg"}:
                path.with_name(path.name + ".gz").write_bytes(gzip.compress(path.read_bytes(), compresslevel=6, mtime=0))
        archive = Path("tmp") / ("dist-" + args.revision + ".tar.gz")
        archive.parent.mkdir(exist_ok=True)
        files = sorted(path for path in args.dist.rglob("*") if path.is_file())
        with tarfile.open(archive, "w:gz") as bundle:
            for path in files:
                bundle.add(path, arcname="dist/" + path.relative_to(args.dist).as_posix(), recursive=False)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        run(client, "mkdir -p " + shlex.quote(release))
        LOG.info("Uploading %.1f MB for release %s", archive.stat().st_size / 1e6, args.revision)
        remote_archive = release + "/dist.tar.gz"
        sftp.put(str(archive), remote_archive)
        actual = run(client, "sha256sum " + shlex.quote(remote_archive)).split()[0]
        if actual != digest:
            raise RuntimeError("Uploaded archive checksum mismatch")
        run(client, "tar -xzf " + shlex.quote(remote_archive) + " -C " + shlex.quote(release))
        # Retain only the preceding build's named chunks (not an ever-growing historical union).
        previous_context = re.search(r"context: \./(releases/[^\s]+)", current)
        if previous_context:
            previous = remote_dir + "/" + previous_context.group(1)
            previous_manifest = previous + "/asset-files.json"
            try:
                previous_assets = json.loads(sftp.open(previous_manifest).read().decode())
            except FileNotFoundError:
                previous_assets = [name for name in sftp.listdir(previous + "/dist/assets") if not name.endswith(".map")]
            for name in previous_assets:
                if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
                    raise ValueError("Invalid previous asset filename")
                destination = release + "/dist/assets/" + name
                run(client, "test -e " + shlex.quote(destination) + " || cp " + shlex.quote(previous + "/dist/assets/" + name) + " " + shlex.quote(destination))
        write_remote(sftp, release + "/asset-files.json", json.dumps([path.name for path in (args.dist / "assets").iterdir() if path.is_file() and not path.name.endswith(".map")]))
        write_remote(sftp, release + "/Dockerfile", dockerfile)
        write_remote(sftp, release + "/nginx.conf", nginx)
        LOG.info("Building the candidate image; the live container is still unchanged")
        run(client, "docker build -t " + shlex.quote(image) + " " + shlex.quote(release))
        run(client, "docker run -d --rm --network none --name " + shlex.quote(candidate) + " " + shlex.quote(image))
        try:
            run(client, "docker exec " + shlex.quote(candidate) + " nginx -t")
            for attempt in range(30):
                try:
                    health = json.loads(run(client, "docker exec " + shlex.quote(candidate) + " wget -qO- http://127.0.0.1:8080/health"))
                    if health.get("revision") != args.revision:
                        raise RuntimeError("Candidate has the wrong revision")
                    break
                except RuntimeError:
                    if attempt == 29:
                        raise
                    time.sleep(1)
            manifest = json.loads(run(client, "docker exec " + shlex.quote(candidate) + " wget -qO- http://127.0.0.1:8080/models/interior/manifest.json"))
            if len(manifest["products"]) != expected_count:
                raise RuntimeError("Candidate does not contain the expanded catalogue")
        finally:
            run(client, "docker stop " + shlex.quote(candidate))
        backup = compose_path + ".before-" + stamp
        write_remote(sftp, backup, current)
        write_remote(sftp, compose_path + ".next", new_compose)
        sftp.posix_rename(compose_path + ".next", compose_path)
        LOG.info("Candidate passed. Switching the existing app service; rollback configuration: %s", backup)
        try:
            run(client, compose + " up -d --no-build --no-deps house-web-mcp")
            for attempt in range(45):
                try:
                    health = json.loads(run(client, "curl -fsS --max-time 5 http://127.0.0.1:" + str(int(config["HOUSE_DEPLOY_PUBLIC_PORT"])) + "/health"))
                    if health.get("revision") != args.revision:
                        raise RuntimeError("Live service has the wrong revision")
                    break
                except RuntimeError:
                    if attempt == 44:
                        raise
                    time.sleep(1)
        except Exception:
            write_remote(sftp, compose_path + ".rollback", current)
            sftp.posix_rename(compose_path + ".rollback", compose_path)
            run(client, compose + " up -d --no-build --no-deps house-web-mcp")
            raise
        record = {"commit": args.revision, "image": image, "url": config["HOUSE_DEPLOY_URL"],
                  "archiveSha256": digest, "composeBackup": backup, "deployedAt": stamp, "catalogueCount": len(manifest["products"])}
        write_remote(sftp, config["HOUSE_DEPLOY_PATH"] + "/deployment.json", json.dumps(record, indent=2) + "\n")
        write_remote(sftp, config["HOUSE_DEPLOY_PATH"] + "/deployment.txt",
                     "app=House_Web_MCP\nbranch=codex/deploy-furnished-zielonki\n"
                     + "\n".join(f"{key}={value}" for key, value in record.items()) + "\n")
        Path("tmp/deployment-result.json").write_text(json.dumps(record, indent=2) + "\n")
        LOG.info("Published %s at %s", args.revision, config["HOUSE_DEPLOY_URL"])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    main()
