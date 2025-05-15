import { addPopup, removePopup } from './popup'

describe('Popup tests', () => {
  test('addPopup should add correct popup', () => {
    const link = 'https://some.domain?link_style=eyJpciI6IDIsICJpbyI6IDAuOH0='
    addPopup(link)

    const stylesElement = document.getElementById('mesh-link-popup__styles')
    expect(stylesElement).toBeTruthy()
    expect(stylesElement).toMatchSnapshot()

    const popupElement = document.getElementById('mesh-link-popup')
    expect(popupElement).toBeTruthy()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(link)
  })

  test('addPopup when popup already added should replace popup', () => {
    addPopup('http://localhost/1')
    addPopup('http://localhost/2')

    const stylesElement = document.getElementById('mesh-link-popup__styles')
    expect(stylesElement).toBeTruthy()

    const popupElement = document.getElementById('mesh-link-popup')
    expect(popupElement).toBeTruthy()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/2'
    )
  })

  test('removePopup should remove popup', () => {
    addPopup('http://localhost/1')
    removePopup()

    const stylesElement = document.getElementById('mesh-link-popup__styles')
    expect(stylesElement).toBeFalsy()

    const popupElement = document.getElementById('mesh-link-popup')
    expect(popupElement).toBeFalsy()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
  })
})
