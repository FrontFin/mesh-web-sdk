const popupId = 'front-link-popup'
const backdropId = 'front-link-popup__backdrop'
const popupContentId = 'front-link-popup__popup-content'
const stylesId = 'front-link-popup__styles'
export const iframeId = 'front-link-popup__iframe'

const getPopupHtml = (link: string) => `
<div id="${popupId}">
  <div id="${backdropId}"></div>
  <div id="${popupContentId}">
    <iframe id="${iframeId}" src="${link}" allow="clipboard-read *; clipboard-write *" />
  </div>
</div>
`

const styles = `
<style id="${stylesId}">
  body {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    overflow: hidden;
  }

  #${popupId} {
    all: unset;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  #${backdropId} {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10000;
    background: black;
    opacity: 0.6;
  }

  #${popupContentId} {
    position: absolute;
    height: 80%;
    max-height: 710px;
    min-height: 685px;
    margin: auto;
    z-index: 10001;
    width: 30%;
    max-width: 430px;
    min-width: 380px;
    display: flex;
    flex-direction: column;
    border-radius: 24px;
    background: white;
    flex-grow: 1;
  }

  #${popupContentId} iframe {
    border: none;
    width: 100%;
    flex-grow: 1;
    border-radius: 24px;
  }

  @media only screen and (max-width: 768px) {
    #${popupContentId} {
      height: 100vh;
      width: 100vw;
      max-width: 100%;
      min-width: 100%;
      max-height: 100%;
      min-height: 100%;
      border-radius: 0px;
    }

    #${popupContentId} iframe {
      border-radius: 0px;
    }
  }
</style>
`

export function removePopup(): void {
  const existingPopup = window.document.getElementById(popupId)
  if (existingPopup) {
    ;(existingPopup.parentElement || window.document.body).removeChild(
      existingPopup
    )
  }

  const existingStyles = window.document.getElementById(stylesId)
  if (existingStyles) {
    ;(existingStyles.parentElement || window.document.head).removeChild(
      existingStyles
    )
  }
}

export function addPopup(iframeLink: string): void {
  removePopup()
  const popup = getPopupHtml(iframeLink)
  window.document.head.appendChild(htmlToElement(styles))
  window.document.body.appendChild(htmlToElement(popup))
}

function htmlToElement(html: string): Node {
  const template = document.createElement('template')
  html = html.trim()
  template.innerHTML = html
  return template.content.firstChild || document.createTextNode('')
}
