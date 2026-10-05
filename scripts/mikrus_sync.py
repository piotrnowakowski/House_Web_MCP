"""Secret-safe runtime configuration and Compose additions for the private sync API."""
import json
from pathlib import Path
import shlex
from datetime import datetime, timezone

KEYS = ('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'HOUSE_SYNC_KEY_HASH', 'HOUSE_SYNC_ORIGINS')


def provision_env(sftp, remote_dir, config):
    """Explicit provisioning only. Ordinary deployments reuse this file unchanged."""
    for key in KEYS:
        if not config.get(key) or '\n' in config[key] or '\r' in config[key] or "'" in config[key]:
            raise ValueError('Missing or unsupported runtime setting: ' + key)
    if config['PGSSLMODE'] not in ('verify-full', 'require'):
        raise ValueError('Encrypted database connection is required')
    path = remote_dir + '/.env'
    try:
        with sftp.open(path) as source:
            previous = source.read().decode()
    except FileNotFoundError:
        previous = ''
    values = {key: config[key] for key in KEYS}
    values['HOUSE_SYNC_PUBLIC_ACCESS'] = config.get('HOUSE_SYNC_PUBLIC_ACCESS', 'false')
    if values['HOUSE_SYNC_PUBLIC_ACCESS'] not in ('true', 'false'):
        raise ValueError('HOUSE_SYNC_PUBLIC_ACCESS must be true or false')
    if config.get('PGSSLROOTCERT'):
        ca = Path(config['PGSSLROOTCERT'])
        sftp.put(str(ca), remote_dir + '/pg-ca.pem')
        sftp.chmod(remote_dir + '/pg-ca.pem', 0o644)  # CA certificate is public, not a credential.
        values['PGSSLROOTCERT'] = '/run/house-sync/pg-ca.pem'
    lines = []
    for line in previous.splitlines():
        key = line.split('=', 1)[0].strip()
        if key not in values:
            lines.append(line)
    lines.extend(key + "='" + value + "'" for key, value in values.items())
    if previous:
        backup = path + '.before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        with sftp.open(backup, 'wx') as target:
            sftp.chmod(backup, 0o600)
            target.write(previous)
    temporary = path + '.next'
    with sftp.open(temporary, 'w') as target:
        sftp.chmod(temporary, 0o600)
        target.write('\n'.join(lines) + '\n')
    sftp.posix_rename(temporary, path)
    sftp.chmod(path, 0o600)


def sync_compose(current, revision, project, remote_dir, has_ca):
    import yaml
    document = yaml.safe_load(current)
    services = document['services']
    if 'house-web-mcp' not in services:
        raise ValueError('Expected house-web-mcp service')
    web = services['house-web-mcp']
    web['build'] = {'context': './releases/' + revision}
    web['image'] = project + ':' + revision
    web['depends_on'] = {'house-sync-api': {'condition': 'service_healthy'}}
    runtime = {key: '${' + key + ':?' + key + ' is required}' for key in KEYS}
    runtime['PORT'] = '8081'
    runtime['HOUSE_SYNC_PUBLIC_ACCESS'] = '${HOUSE_SYNC_PUBLIC_ACCESS:-false}'
    api = {'image': project + '-sync:' + revision, 'build': {'context': './releases/' + revision, 'dockerfile': 'Api.Dockerfile'},
           'restart': 'unless-stopped', 'environment': runtime, 'expose': ['8081'], 'mem_limit': '256m', 'read_only': True,
           'tmpfs': ['/tmp'], 'security_opt': ['no-new-privileges:true'], 'cap_drop': ['ALL']}
    if has_ca:
        runtime['PGSSLROOTCERT'] = '/run/house-sync/pg-ca.pem'
        api['volumes'] = [remote_dir + '/pg-ca.pem:/run/house-sync/pg-ca.pem:ro']
    # Preserve the frontend's existing networks and port mappings (including IPv6).
    if 'networks' in web:
        api['networks'] = web['networks']
    services['house-sync-api'] = api
    backup = {'image': 'postgres:17-alpine', 'profiles': ['backup'], 'environment': {k: v for k, v in runtime.items() if k.startswith('PG')},
              'entrypoint': ['pg_dump'], 'command': ['--format=custom', '--no-owner', '--no-acl', '--table=house_sync_*'], 'read_only': True,
              'tmpfs': ['/tmp']}
    if has_ca: backup['volumes'] = api['volumes']
    services['house-sync-backup'] = backup
    return json.dumps(document, indent=2) + '\n'


def backup_database(client, run, compose, remote_dir):
    """Use a one-shot pg_dump service, with credentials resolved by Compose, never the shell."""
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = remote_dir + '/backups/house-sync-' + stamp + '.dump'
    run(client, 'mkdir -p ' + shlex.quote(remote_dir + '/backups') + ' && chmod 700 ' + shlex.quote(remote_dir + '/backups'))
    run(client, 'umask 077; ' + compose + ' run --rm --no-deps house-sync-backup > ' + shlex.quote(destination))
    return destination
