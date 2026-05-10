import json
import os
import shutil
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from lib.bird_x import parse_bird_response


REPO_ROOT = Path(__file__).resolve().parents[1]
VENDORED_BIRD = REPO_ROOT / "scripts" / "lib" / "vendor" / "bird-search" / "bird-search.mjs"


class TestBirdXEngagementZero(unittest.TestCase):
    def test_zero_likes_preserved(self):
        tweets = [
            {
                "id": "1",
                "text": "test",
                "permanent_url": "https://x.com/u/status/1",
                "likeCount": 0,
                "retweetCount": 5,
            }
        ]
        items = parse_bird_response(tweets, "test query")
        self.assertEqual(0, items[0]["engagement"]["likes"])
        self.assertEqual(5, items[0]["engagement"]["reposts"])


@unittest.skipUnless(shutil.which("node"), "node is required for vendored Bird tests")
class TestVendoredBirdRuntime(unittest.TestCase):
    def test_check_uses_env_credentials_without_browser_cookie_dependency(self):
        env = os.environ.copy()
        env["AUTH_TOKEN"] = "dummy-auth"
        env["CT0"] = "dummy-ct0"

        result = subprocess.run(
            ["node", str(VENDORED_BIRD), "--check"],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(0, result.returncode, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["authenticated"])
        self.assertEqual("env AUTH_TOKEN", payload["source"])

    def test_check_with_browser_lookup_disabled_returns_json_warnings(self):
        env = os.environ.copy()
        env.pop("AUTH_TOKEN", None)
        env.pop("CT0", None)
        env["BIRD_DISABLE_BROWSER_COOKIES"] = "1"

        result = subprocess.run(
            ["node", str(VENDORED_BIRD), "--check"],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(1, result.returncode, result.stderr)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["authenticated"])
        self.assertTrue(payload["warnings"])
        self.assertIn("Missing auth_token", " ".join(payload["warnings"]))

    def test_browser_cookie_helpers_lazy_load_sweet_cookie(self):
        sweet_cookie_dir = (
            REPO_ROOT
            / "scripts"
            / "lib"
            / "vendor"
            / "bird-search"
            / "lib"
            / "node_modules"
            / "@steipete"
            / "sweet-cookie"
        )
        if sweet_cookie_dir.exists():
            self.skipTest("vendored sweet-cookie test stub already exists")

        sweet_cookie_dir.mkdir(parents=True)
        (sweet_cookie_dir / "package.json").write_text(
            json.dumps(
                {
                    "name": "@steipete/sweet-cookie",
                    "type": "module",
                    "exports": "./index.js",
                }
            ),
            encoding="utf-8",
        )
        (sweet_cookie_dir / "index.js").write_text(
            textwrap.dedent(
                """
                export async function getCookies(options) {
                  const browser = options.browsers?.[0] ?? "unknown";
                  return {
                    cookies: [
                      { name: "auth_token", value: `${browser}-auth`, domain: "x.com" },
                      { name: "ct0", value: `${browser}-ct0`, domain: "x.com" },
                    ],
                    warnings: [],
                  };
                }
                """
            ),
            encoding="utf-8",
        )

        try:
            result = subprocess.run(
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    textwrap.dedent(
                        """
                        import {
                          extractCookiesFromSafari,
                          extractCookiesFromChrome,
                          extractCookiesFromFirefox,
                        } from "./scripts/lib/vendor/bird-search/lib/cookies.js";

                        const payload = await Promise.all([
                          extractCookiesFromSafari(),
                          extractCookiesFromChrome("Profile 1"),
                          extractCookiesFromFirefox("default-release"),
                        ]);
                        process.stdout.write(JSON.stringify(payload));
                        """
                    ),
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual("Safari", payload[0]["cookies"]["source"])
            self.assertEqual('Chrome profile "Profile 1"', payload[1]["cookies"]["source"])
            self.assertEqual(
                'Firefox profile "default-release"', payload[2]["cookies"]["source"]
            )
            self.assertEqual("safari-auth", payload[0]["cookies"]["authToken"])
            self.assertEqual("chrome-auth", payload[1]["cookies"]["authToken"])
            self.assertEqual("firefox-auth", payload[2]["cookies"]["authToken"])
        finally:
            shutil.rmtree(sweet_cookie_dir, ignore_errors=True)
            for path in [sweet_cookie_dir.parent, sweet_cookie_dir.parent.parent]:
                try:
                    path.rmdir()
                except OSError:
                    pass

    def test_none_likes_when_missing(self):
        tweets = [
            {
                "id": "1",
                "text": "test tweet with no engagement fields",
                "permanent_url": "https://x.com/u/status/1",
                # no likeCount, like_count, or favorite_count
            }
        ]
        items = parse_bird_response(tweets, "test query")
        self.assertIsNone(items[0]["engagement"]["likes"])

    def test_fallback_to_second_key(self):
        tweets = [
            {
                "id": "1",
                "text": "test",
                "permanent_url": "https://x.com/u/status/1",
                "like_count": 7,
            }
        ]
        items = parse_bird_response(tweets, "test query")
        self.assertEqual(7, items[0]["engagement"]["likes"])

    def test_zero_does_not_fall_through(self):
        """likeCount=0 should not fall through to like_count=10."""
        tweets = [
            {
                "id": "1",
                "text": "test",
                "permanent_url": "https://x.com/u/status/1",
                "likeCount": 0,
                "like_count": 10,
            }
        ]
        items = parse_bird_response(tweets, "test query")
        self.assertEqual(0, items[0]["engagement"]["likes"])


if __name__ == "__main__":
    unittest.main()
