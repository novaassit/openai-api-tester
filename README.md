# OpenAI API Tester

OpenAI API를 브라우저에서 간편하게 테스트할 수 있는 웹 앱입니다.

## Features

- **Stream / Non-stream** 모드 전환
- **모델 선택** — gpt-4o, gpt-4o-mini, o1, o3-mini 등 + 커스텀 모델 ID 입력
- **파라미터 조절** — Temperature, Max Tokens, System Prompt
- **실시간 스트리밍** — SSE 기반 토큰 단위 실시간 출력
- **Stop** — 스트리밍 중단
- **멀티턴 대화** — 대화 히스토리 유지
- **Latency / Token 사용량** 표시
- **Raw Response** 원본 응답 확인

## Getting Started

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 실행됩니다.

## Usage

1. OpenAI API Key 입력 (브라우저에서만 사용, 서버 저장 없음)
2. 모델 선택 또는 커스텀 모델 ID 입력
3. Stream 체크박스로 스트리밍 모드 선택
4. 메시지 입력 후 Send (Enter로 전송, Shift+Enter로 줄바꿈)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- OpenAI SDK
