import { parseCorrectedLines } from './parseCorrectedLines'
import { describe, expect, it } from 'bun:test'

describe('parseCorrectedLines', () => {
  it('reads the corrected lines back', () => {
    const answer = '{"lines":["E o nouă zi, soarele răsare,","Cântă suflet"]}'
    expect(parseCorrectedLines(answer, 2)).toEqual([
      'E o nouă zi, soarele răsare,',
      'Cântă suflet',
    ])
  })

  it('reaches past a code fence and any prose around it', () => {
    const answer =
      'Here is the corrected passage:\n```json\n{ "lines": ["Cântă"] }\n```\nDone.'
    expect(parseCorrectedLines(answer, 1)).toEqual(['Cântă'])
  })

  it('keeps empty lines, which are blank lines on the slide', () => {
    expect(parseCorrectedLines('{"lines":["Prima","","A treia"]}', 3)).toEqual([
      'Prima',
      '',
      'A treia',
    ])
  })

  it('refuses an answer that added a line', () => {
    expect(parseCorrectedLines('{"lines":["a","b","c"]}', 2)).toBeNull()
  })

  it('refuses an answer that merged lines away', () => {
    expect(parseCorrectedLines('{"lines":["a b"]}', 2)).toBeNull()
  })

  it('refuses an answer that is not lines of text', () => {
    expect(parseCorrectedLines('{"lines":[1,2]}', 2)).toBeNull()
    expect(parseCorrectedLines('{"lines":"nope"}', 1)).toBeNull()
    expect(parseCorrectedLines('{"text":"nope"}', 1)).toBeNull()
  })

  it('refuses an answer with no JSON in it at all', () => {
    expect(parseCorrectedLines('I cannot do that.', 1)).toBeNull()
  })

  it('refuses malformed JSON rather than throwing', () => {
    expect(parseCorrectedLines('{"lines":["a",}', 1)).toBeNull()
  })
})
