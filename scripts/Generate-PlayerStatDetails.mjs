// Reproducible development diagram; synthetic examples only.
import fs from 'node:fs/promises'
const target = new URL('../docs/diagrams/player-stat-details.svg', import.meta.url)
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1080" viewBox="0 0 1400 1080" role="img" aria-labelledby="title desc"><title id="title">조축ON 선수 입력과 세부 기록 흐름</title><desc id="desc">로컬 개발 기능. 생년과 등번호 입력, 총 득점 안의 프리킥 및 페널티킥, 연도와 대회 필터, 1~4쿼터당 집계를 설명한다.</desc><rect width="1400" height="1080" fill="#f6f8f3"/><g font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif">'
function text(x,y,value,size=22,color='#52675d',weight=400){svg+=`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${escape(value)}</text>`}
function card(x,y,w,h,title,lines,color='#fff'){svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" stroke="#d4dfd4"/>`;text(x+24,y+44,title,27,'#245f49',700);lines.forEach((line,i)=>text(x+24,y+88+i*35,line))}
text(48,48,'JOCHOOK ON · 조축ON',22,'#245f49',700)
text(930,48,'2026.10.15 · 로컬 개발 / 운영 미반영',20)
text(48,112,'입력은 편하게, 기록은 같은 기준으로',39,'#203e32',700)
text(48,160,'팀의 원본 기록을 모아 연도·리그·대회별로 확인해요.',24)
card(48,205,625,235,'01  생년 · 등번호 입력', ['직접 입력 + 드롭다운을 함께 사용', '생년 목록: 1950년 ~ 올해 − 17년', '등번호: 활동 회원·용병이 쓰지 않는 1~99번', '여러 명 입력 시 다른 행의 번호도 제외'])
card(725,205,625,235,'02  03단계 세부 득점', ['총 득점 안에 FK·PK를 구분해 입력', '총 3골 = 다른 골 1 + 직접 FK 1 + PK 1', '선발·교체 모두 기록 · 승부차기 제외', 'FK + PK가 총 득점보다 클 수 없음'])
card(48,480,625,220,'03  조회할 기록 선택', ['목록·선수 상세에서 연도와 범위를 선택', '합산 / 리그만 / 대회만 / 특정 대회', '리그에는 자체전도 포함', '기록 완료·용병 포함 조건도 유지'],'#eaf1f8')
card(725,480,625,220,'04  누적과 쿼터당 스탯', ['누적 / 1·2·3·4쿼터당 선택', '시즌 합계 ÷ 출전 쿼터 × 선택한 쿼터 수', '교체 출전은 0.5쿼터 · 출전 0은 —', '경기별 카드는 실제 득점·도움 유지'],'#edf4e9')
card(48,742,1302,170,'계산 예시 · 2.5쿼터 동안 2골 · 1도움', ['1쿼터당 0.80골 · 0.40도움     →     4쿼터당 3.20골 · 1.60도움', '4쿼터당은 비교용 환산값이에요. 지금은 프로 90분이나 실제 경기 수로 바꾸지 않아요.'])
text(48,957,'출석은 참석·지각한 경기마다 1회. 같은 날 두 경기면 2회이며, 참석 예정 투표는 제외해요.',22)
text(48,996,'경기별 카드의 프리킥·페널티킥은 득점이 있을 때만 표시해요. 총 골에 다시 더하지 않아요.',22)
text(48,1046,'운영 앱 b9d8738 · 가이드 1.1 유지  |  docs/player-input-and-stat-details.md',19,'#68776c')
svg+='</g></svg>\n';await fs.writeFile(target,svg)
