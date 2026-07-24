# 깃허브에 올리기

## 올리기 전에 확인

```bash
# 1. 커밋될 파일 목록을 눈으로 확인한다
git init
git add .
git status
```

이 목록에 아래가 있으면 **멈추고 지운다.**

- `input/` 안의 무엇이든 — 클라이언트가 준 자료
- `docs/` `specs/` — 작업 결과물
- `examples/private/` — 클라이언트 실물 예시
- 브랜드명·제품명이 박힌 JSON

`.gitignore` 가 위 경로를 막고 있지만, **이미 커밋한 적이 있으면 무시됩니다.**
그럴 땐 `git rm -r --cached <경로>` 로 인덱스에서 먼저 빼세요.

## 왜 이렇게까지 하냐면

한 번 푸시된 파일은 나중에 지워도 커밋 기록에 남습니다.
그리고 클라이언트 입장에서, 자기 자료가 남의 깃허브에 있는 걸 보면
다음 일을 맡기기 어려워집니다. 기술적 문제이기 전에 신뢰 문제입니다.

## 커밋

```bash
git add .
git commit -m "카드뉴스 기획 스튜디오 초기 버전"
git branch -M main
git remote add origin https://github.com/<계정>/cardnews-studio.git
git push -u origin main
```

## 저장소 설명에 쓸 문장

> 카드뉴스를 기획 산출물로 다루는 피그마 플러그인.
> PRD·기능명세·유저플로우·와이어프레임을 한 번에 생성합니다.

토픽: `figma-plugin` `content-design` `product-planning` `korean`

## 포트폴리오로 쓸 때

README 상단에 **결과물 이미지 두 장**을 넣으세요. 코드보다 그게 먼저 읽힙니다.

```markdown
![샘플](docs/preview-sample.png)
```

그리고 이 세 가지를 README에 적어두면 읽는 사람이 판단할 재료가 생깁니다.

1. **왜 만들었는지** — 결과물만 있고 그 뒤의 판단이 남지 않는 문제
2. **어떤 선택을 했는지** — 템플릿 고정 대신 레이아웃 엔진, 생성과 렌더링 사이의 검토 단계
3. **무엇이 아직 부족한지** — 자동 생성 시안의 완성도 한계, 텍스트 높이 추정 오차

세 번째를 적는 저장소가 드뭅니다. 적어두면 눈에 띕니다.
