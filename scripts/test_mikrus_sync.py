"""Offline tests for deployment configuration; never connect to a real host."""
import json
import unittest
from io import BytesIO
from mikrus_sync import provision_env, sync_compose

class File(BytesIO):
    def __init__(self, owner, path, data=b''):
        super().__init__(data); self.owner = owner; self.path = path
    def write(self, value):
        return super().write(value.encode() if isinstance(value, str) else value)
    def close(self):
        self.owner.files[self.path] = self.getvalue()
        super().close()

class Sftp:
    def __init__(self): self.files = {}; self.modes = {}
    def open(self, path, mode='r'):
        if mode == 'r' and path not in self.files: raise FileNotFoundError()
        return File(self, path, self.files.get(path, b'') if mode == 'r' else b'')
    def chmod(self, path, mode): self.modes[path] = mode
    def posix_rename(self, source, target):
        self.files[target] = self.files.pop(source)

class SyncDeployment(unittest.TestCase):
    def test_preserves_unrelated_env_and_uses_private_permissions(self):
        sftp = Sftp(); sftp.files['/app/deploy/.env'] = b"UNRELATED=keep\nPGHOST=old\n"
        config = dict(PGHOST='db.example', PGPORT='5432', PGDATABASE='test', PGUSER='test', PGPASSWORD='test-secret', PGSSLMODE='verify-full', HOUSE_SYNC_KEY_HASH='a'*64, HOUSE_SYNC_ORIGINS='https://house.example', HOUSE_SYNC_CONNECTION_KEY='never-on-server')
        provision_env(sftp, '/app/deploy', config)
        text = sftp.files['/app/deploy/.env'].decode()
        self.assertIn('UNRELATED=keep', text)
        self.assertNotIn('PGHOST=old', text)
        self.assertNotIn('never-on-server', text)
        self.assertEqual(sftp.modes['/app/deploy/.env'], 0o600)
        self.assertTrue(all(mode == 0o600 for mode in sftp.modes.values()))
        self.assertTrue(any('.before-' in path for path in sftp.files))

    def test_compose_preserves_both_port_bindings_and_runtime_separation(self):
        prior = json.dumps({'services': {'house-web-mcp': {'ports': ['0.0.0.0:20203:8080', '[::]:20203:8080'], 'networks': ['app']}, 'unrelated': {'image': 'untouched'}}, 'networks': {'app': {}}})
        result = json.loads(sync_compose(prior, 'a'*40, 'house', '/app/deploy', True))
        self.assertEqual(result['services']['house-web-mcp']['ports'], ['0.0.0.0:20203:8080', '[::]:20203:8080'])
        api = result['services']['house-sync-api']
        self.assertNotIn('ports', api)
        self.assertNotIn('HOUSE_SYNC_CONNECTION_KEY', api['environment'])
        self.assertNotIn('env_file', api)
        self.assertEqual(api['networks'], ['app'])
        self.assertEqual(result['services']['unrelated'], {'image': 'untouched'})
        self.assertIn('house-sync-backup', result['services'])

if __name__ == '__main__': unittest.main()
