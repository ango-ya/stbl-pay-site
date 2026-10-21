"""E2E 用に dist/ を配信する。

python3 -m http.server は接続待ちの列が 5 本しかない（request_queue_size）。docs のページは
JS やフォントを並列に多数読むため、Playwright を並列で回すと列があふれ、ERR_CONNECTION_RESET
で落ちることがある。列を広げただけの同じサーバーを使う。
"""

import functools
import http.server
import sys


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128


def main() -> None:
    port = int(sys.argv[1])
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory="dist")
    with Server(("127.0.0.1", port), handler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()
