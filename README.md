# 카드뉴스 기획 스튜디오

카드뉴스를 **결과물이 아니라 기획 산출물로** 다루는 도구입니다.
완성된 카드뉴스 또는 제품 설명을 넣으면 PRD · 기능명세 · 유저플로우 · 와이어프레임 ·
카드 시안을 피그마 안에 한 번에 그립니다.

- 디자인을 템플릿으로 고정하지 않습니다. AI가 `design` 토큰과 `blocks` 배치를 직접 짜고,
  플러그인은 그걸 그리는 레이아웃 엔진 역할만 합니다
- 생성과 렌더링 사이에 **사람이 검토하는 단계**가 있습니다. 카피 초안은 AI가, 톤 판단은 사람이
- API 키 없이 쓸 수 있습니다. 프롬프트를 복사해 claude.ai에 붙여넣고 결과를 되돌려주는 방식
- `tools/preview.js` 로 피그마 없이 배치를 검증합니다

MIT 라이선스. `examples/library/sample.json` 은 가상의 브랜드로 만든 샘플입니다.

---

완성된 카드뉴스를 넣으면 **그게 만들어지기까지의 기획 문서를 역으로 복원**합니다.
"이 결과물 뒤에 이런 판단이 있었다"를 제3자에게 증명하는 용도입니다.

## 무엇을 만드는가

완성된 카드뉴스를 넣으면, 그것을 제품으로 보고 기획 문서 4종을 역으로 복원합니다.
그리고 그 4종이 피그마 보드로 그려집니다.

| 보드 | 내용 |
|---|---|
| 01 요구사항 정의 (PRD) | 배경 · 문제 정의 · 타겟 · 인식 수준 · 목표와 측정 지표 · 범위 · 개선점 |
| 02 기능명세서 | 구성 요소 계층 트리 (1 / 1.1) + 관련 카드 ID |
| 03 유저플로우 | 진입 · 탐색 · 전환 밴드 + 이탈 예상 지점 |
| 04 와이어프레임 | 카드별 구조 + 좌측 전체 카드 목록 + 왜 이 구조인지 캡션 |
| 05 카드뉴스 시안 | 브랜드 컬러가 적용된 결과물 (선택) |

## 두 가지 경로

### 경로 1 — 클로드 코드 (문서를 깊게 파고 싶을 때)

```
input/ 에 카드 이미지 + notes 파일
   │ /analyze   docs/A00-teardown.md   카드별 해부
   │ /brief     docs/A01-brief.md      콘텐츠 기획서
   │ /message   docs/A02-message.md    메시지 설계서
   │ /studio    specs/studio.json      → 피그마 플러그인에 붙여넣기
   │ /package   docs/00-summary.md     제출용 한 장 요약
```

원본 이미지를 직접 읽고 단계마다 사람이 확인하므로 근거가 촘촘합니다.
API 키가 필요 없습니다.

### 경로 2 — 피그마 플러그인 단독 (빠르게 한 바퀴)

플러그인에 카드 문구와 캡션을 붙여넣고 바로 생성합니다.
`직접 붙여넣기` 모드를 쓰면 claude.ai에 프롬프트를 옮겨 붙이는 방식이라 역시 무료입니다.

### 웹 기획 역기획 (선택)

카드뉴스가 아니라 "이 브랜드를 웹 서비스로 만든다면"을 기획하고 싶을 때 씁니다.
`/prd` `/ia` `/spec` `/flow` `/wireframe` — 산출물은 `docs/B*.md` 와 `specs/screens.json`.
웹기획 포지션 지원용이면 이쪽도 함께 만드세요.

## 피그마 플러그인

1. 피그마 **데스크톱 앱** → `Plugins` → `Development` → `Import plugin from manifest…`
2. `figma-plugin/manifest.json` 선택
3. 설정에서 브랜드명 · 핸들 · 컬러 · 비율 입력
4. `specs/studio.json` 내용을 `결과 붙여넣기` 칸에 → **JSON 확인** → **피그마에 생성**

만들 보드를 체크박스로 고를 수 있습니다.
자세한 내용은 `figma-plugin/README.md`.

## 왜 중간에 JSON을 두는가

AI에게 곧바로 "와이어프레임 그려줘" 하면 돌릴 때마다 다른 게 나옵니다.
그래서 문서와 그림 사이에 손으로 고칠 수 있는 JSON을 끼워넣었습니다.

- **재현성** — 같은 JSON은 항상 같은 결과
- **수정 비용** — 한 줄만 고치면 됨. 전체 재생성 불필요
- **책임 분리** — 판단은 AI가, 그리기는 결정론적 코드가

규격은 `schemas/studio.schema.json`,
실제로 돌아가는 완성본은 `examples/studio.example.json` (로얄베이비 4장).

## 지어내기 방지

| 표시 | 뜻 |
|---|---|
| `[카드뉴스]` | 결과물에 실제로 있는 것 |
| `[메모]` | 보조 자료에 있는 것 |
| `[추정]` | 결과물에서 역으로 읽어낸 해석 |

`[추정]`을 지우지 마세요. 드러내는 편이 신뢰를 줍니다.
실측 지표가 없으면 `-` 로 비웁니다.

## 피그마 플러그인 — 카드뉴스 기획 스튜디오

터미널을 안 거치고 **피그마 안에서 전부 끝내는** 경로입니다.
제품 설명이나 인스타 캡션을 붙여넣으면 기획 문서 보드 + 와이어프레임 + 카드 시안이
한 번에 생성됩니다.

1. 피그마 **데스크톱 앱** → `Plugins` → `Development` → `Import plugin from manifest…`
2. `figma-plugin/manifest.json` 선택
3. 설정에서 API 키(Claude 또는 Gemini), 브랜드명·핸들·컬러·비율·카드 수 입력
4. 텍스트 붙여넣고 **기획 생성** → 검토 → **피그마에 생성**

생성과 그리기 사이에 검토 단계가 있습니다. 카피 초안은 AI가, 톤 판단은 사람이 합니다.
자세한 내용은 `figma-plugin/README.md`.

**클로드 코드 트랙과의 관계** — 플러그인은 빠른 한 바퀴용이고,
클로드 코드 트랙(`/analyze` … `/package`)은 제출용 문서를 깊게 파는 용도입니다.
증명 자료를 만들 거라면 클로드 코드 트랙이 문서 밀도가 훨씬 높습니다.

## 블록 타입

`schemas/screens.schema.json` 이 전체 규격입니다.
`examples/screens.example.json` (웹) / `examples/cards.example.json` (카드뉴스) 참고.

| 타입 | 용도 | 옵션 |
|---|---|---|
| `nav` | 상단 네비 (뒤로 + 타이틀) | `label` |
| `header` | 섹션 헤더 | `label` |
| `hero` | 큰 카피 영역 | `label` `height` |
| `text` | 문구 한 줄 | `label` |
| `image` | 이미지 자리 | `height` |
| `searchbar` | 검색 입력 | `label` |
| `chips` | 필터·정렬 칩 줄 | `label`을 `/`로 구분 |
| `input` | 입력 필드 | `label` |
| `button` | 버튼 | `variant`: primary·secondary·ghost |
| `card` | 썸네일+제목+메타+액션 | `label` `meta[]` `action` `items` |
| `list` | 단순 반복 행 | `items` |
| `grid` | 격자 | `items` `columns` |
| `table` | 표 | `label`을 `·`로 열 구분, `items` `columns` |
| `tabbar` | 하단 탭 (자동 고정) | `label`을 `/`로 구분 |
| `divider` `spacer` | 구분선 · 여백 | `height` |
| `row` | 가로 배치 | `children` |

빈 회색 박스만 나열하면 화면을 이해할 수 없습니다.
`label`에 실제 문구를 넣고, 목록은 `card`에 `meta`·`action`을 채우세요.

## 커스터마이징

문서 항목이나 톤은 `prompts/` 안의 파일만 고치면 됩니다.
`A`로 시작하면 트랙 A, `B`로 시작하면 트랙 B입니다.

## 카피 품질 올리기

`prompts/E-style.md` 에 글자 수 상한과 구성 원칙이 있습니다.
제약이 없으면 결과가 늘어지므로 숫자로 막아둡니다.

`examples/library/` 는 톤 레퍼런스입니다. 설명 열 줄보다 예시 하나가 낫습니다.

```
/plan 5 --ref info       # 정보 전달형 톤
/studio --ref product    # 제품 소개형 톤
```

잘 나온 결과물을 여기 3~5개 쌓아두면 톤이 그쪽으로 붙습니다.
그 이상은 오히려 흐려집니다.

## 다른 사람에게 나눠주기

`DISTRIBUTE.md` 참고. 보내기 전에 `input/` `docs/` `specs/` 를 비우세요.
클라이언트 자료가 들어 있습니다.

## 피그마 없이 검증하기

```bash
node tools/preview.js examples/library/product.json out.svg
```

`figma-plugin/code.js` 를 그대로 돌려서 넘침·겹침·여백을 검사하고 SVG 미리보기를 만듭니다.
JSON을 고칠 때마다 피그마를 열지 않아도 됩니다. 자세한 내용은 `tools/README.md`.
