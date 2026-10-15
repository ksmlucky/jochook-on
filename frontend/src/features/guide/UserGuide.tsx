import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import content from '../../../../docs/guides/content.json'
import memberPdf from '../../../../docs/guides/jochook-on-member-guide.pdf?url'
import staffPdf from '../../../../docs/guides/jochook-on-staff-guide.pdf?url'
import './user-guide.css'

type Audience = 'staff' | 'member'
type GuidePage = {
  kicker: string
  title: string
  lead: string
  openApp?: boolean
  sections: { title: string; steps?: string[]; body?: string[] }[]
  note: string
}
type Guide = { id: string; audience: string; pages: GuidePage[] }

// The guide source supports emphasis and line breaks only; all other text stays escaped.
function guideText(value: string): ReactNode[] {
  let bold = false
  return value.split(/(<\/?b>|<br\s*\/?>)/gi).map((part, index) => {
    if (/^<b>$/i.test(part)) { bold = true; return null }
    if (/^<\/b>$/i.test(part)) { bold = false; return null }
    if (/^<br\s*\/?>$/i.test(part)) return <br key={index} />
    return bold ? <strong key={index}>{part}</strong> : part
  })
}

export function UserGuide({ audience }: { audience: Audience }) {
  const guide = content.guides.find(item => item.id === audience)
  if (!guide) return <section className="directory-section user-guide" id="guide"><h2>사용 가이드</h2><p>가이드를 준비 중이에요.</p></section>
  // A role change must never leave the previously selected staff chapter on screen.
  return <GuideReader key={audience} guide={guide} audience={audience} />
}

function GuideReader({ guide, audience }: { guide: Guide; audience: Audience }) {
  const [chapter, setChapter] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusRequested = useRef(false)
  const page = guide.pages[chapter]
  const pdf = audience === 'staff' ? staffPdf : memberPdf
  const previous = guide.pages[chapter - 1]
  const next = guide.pages[chapter + 1]

  useEffect(() => {
    if (!focusRequested.current) return
    focusRequested.current = false
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [chapter])

  function openChapter(index: number) {
    if (index < 0 || index >= guide.pages.length) return
    if (index === chapter) {
      headingRef.current?.focus()
      return
    }
    focusRequested.current = true
    setChapter(index)
  }

  return <section className="directory-section user-guide" id="guide" aria-labelledby="user-guide-title">
    <header className="user-guide-heading">
      <div>
        <p className="user-guide-audience">{guide.audience}</p>
        <h2 id="user-guide-title">사용 가이드</h2>
        <p className="user-guide-version">가이드 {content.guideVersion} · {content.releaseLabel}</p>
      </div>
      <a className="user-guide-download" href={pdf} download={`jochook-on-${audience}-guide.pdf`}>
        PDF 내려받기 <span aria-hidden="true">↓</span>
      </a>
    </header>

    <div className="user-guide-layout">
      <nav className="user-guide-toc" aria-label={`${guide.audience} 가이드 목차`}>
        <h3>목차</h3>
        <ol>{guide.pages.map((item, index) => <li key={item.kicker}>
          <button type="button" aria-current={chapter === index ? 'step' : undefined} onClick={() => openChapter(index)}>
            <span className="user-guide-toc-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span>{item.title}</span>
          </button>
        </li>)}</ol>
      </nav>

      <div className="user-guide-reading-area">
        <label className="user-guide-mobile-toc" htmlFor="user-guide-chapter-select">
          목차 <span>{chapter + 1} / {guide.pages.length}</span>
          <select id="user-guide-chapter-select" value={chapter} onChange={event => openChapter(Number(event.target.value))}>
            {guide.pages.map((item, index) => <option key={item.kicker} value={index}>{String(index + 1).padStart(2, '0')} · {item.title}</option>)}
          </select>
        </label>

        <article className="user-guide-chapter" aria-labelledby="user-guide-chapter-title">
          <p className="user-guide-kicker">{page.kicker}</p>
          <h3 id="user-guide-chapter-title" className="user-guide-chapter-title" ref={headingRef} tabIndex={-1}>{page.title}</h3>
          <p className="user-guide-lead">{guideText(page.lead)}</p>
          {page.openApp && <a className="user-guide-open-app" href={content.publicUrl} target="_blank" rel="noopener noreferrer">
            조축ON 접속 주소 열기 <span className="user-guide-new-tab">새 탭 ↗</span>
          </a>}
          {page.sections.map((section, index) => <section className="user-guide-content-section" key={section.title} aria-labelledby={`user-guide-section-${index}`}>
            <h4 id={`user-guide-section-${index}`}>{section.title}</h4>
            {section.steps && <ol className="user-guide-steps">{section.steps.map((step, stepIndex) => <li key={stepIndex}>{guideText(step)}</li>)}</ol>}
            {section.body?.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{guideText(paragraph)}</p>)}
          </section>)}
          <aside className="user-guide-note" aria-label="알아두세요"><strong>알아두세요</strong><p>{guideText(page.note)}</p></aside>
        </article>

        <nav className="user-guide-pagination" aria-label="가이드 페이지 이동">
          <button type="button" disabled={!previous} onClick={() => openChapter(chapter - 1)} aria-label={previous ? `이전: ${previous.title}` : '이전 내용 없음'}><span aria-hidden="true">← </span>이전</button>
          <span aria-label={`${guide.pages.length}개 중 ${chapter + 1}번째 내용`}>{chapter + 1} / {guide.pages.length}</span>
          <button type="button" disabled={!next} onClick={() => openChapter(chapter + 1)} aria-label={next ? `다음: ${next.title}` : '다음 내용 없음'}>다음<span aria-hidden="true"> →</span></button>
        </nav>
      </div>
    </div>
  </section>
}
