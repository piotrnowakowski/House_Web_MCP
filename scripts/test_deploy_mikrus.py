"""Offline test for release-folder retention; never connects to a real host."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("deploy_mikrus", Path(__file__).with_name("deploy-mikrus.py"))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class StaleReleases(unittest.TestCase):
    def test_keeps_live_and_previous_release_only(self):
        names = ["d53afaa1", "d00427bd", "ffbb060", "927a7e8673c949c8fdce821edf583c8d8e19578e"]
        self.assertEqual(deploy.stale_releases(names, {"d53afaa1", "d00427bd"}),
                         ["927a7e8673c949c8fdce821edf583c8d8e19578e", "ffbb060"])

    def test_never_touches_unexpected_names(self):
        self.assertEqual(deploy.stale_releases(["..", "backup", "notes.txt", "abc"], {""}), [])


if __name__ == "__main__":
    unittest.main()
