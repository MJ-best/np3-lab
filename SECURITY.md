# Security

## 취약점 제보 / Reporting a vulnerability

보안 문제를 발견하면 공개 이슈 대신 GitHub의 **[비공개 취약점 제보](https://github.com/MJ-best/np3-lab/security/advisories/new)**로 알려 주세요. 가능한 한 빨리 확인하고 답하겠습니다.
Please report security issues privately through **[GitHub private vulnerability reporting](https://github.com/MJ-best/np3-lab/security/advisories/new)** rather than a public issue.

지원 버전은 [최신 릴리스](https://github.com/MJ-best/np3-lab/releases/latest)입니다. / Only the latest release is supported.

## 설계 / How the app is built

- 앱이 다루는 파일은 메모리 카드의 `NIKON/CUSTOMPC/*.NP3`, 사용자가 고른 내보내기 폴더, 그리고 이 Mac에서 찾은 NP3 파일(읽기 전용)뿐입니다. The app only touches `NIKON/CUSTOMPC/*.NP3` on memory cards, export folders the user picks, and NP3 files found on the Mac (read only).
- 화면(렌더러)은 sandbox·contextIsolation으로 격리되어 있고, 파일 작업은 메인 프로세스가 이름·크기·NP3 헤더를 검사한 뒤에만 합니다. The renderer is sandboxed with context isolation; the main process validates every file name, size and NP3 header.
- 페이지는 Content Security Policy로 번들된 스크립트만 실행하고, 네트워크는 GitHub·jsDelivr(커뮤니티 레시피)에만 연결합니다. 받은 파일은 SHA-256으로 확인합니다. A Content Security Policy allows only the bundled script and connections to GitHub and jsDelivr; downloaded recipes are checked against their SHA-256.
- 설치된 앱은 Electron fuse로 Node 실행 모드·디버거·외부 설정 주입을 막습니다. The packaged app disables Electron's run-as-node mode, inspector and debugging switches.
- 앱은 Apple 개발자 서명·공증이 없습니다. 릴리스마다 `SHA256SUMS.txt`를 함께 올리니, 받은 DMG를 확인한 뒤 여세요. The app isn't notarized; verify the DMG against `SHA256SUMS.txt` in each release:

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```
