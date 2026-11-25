import type { ContentType } from '../../types'
import type { ContentData } from '../rendering/types'

/** What the editor draws on each slide type while its layout is edited. */
export const SAMPLE_CONTENT: Record<
  ContentType,
  {
    main?: string
    reference?: string
    person?: string
    songKey?: string
    amen?: string
    songTitle?: string
    songTitleNumber?: string
  }
> = {
  song: {
    main: 'Aleluia, Aleluia!\nMărire Domnului!\nAleluia, Aleluia!\nSlăvit să fie El!',
    songKey: 'G',
    amen: 'Amin!',
    songTitle: 'Aleluia, mărire Domnului',
    songTitleNumber: 'PDC 19',
  },
  song_first_slide: {
    main: 'Aleluia, Aleluia!\nMărire Domnului!\nAleluia, Aleluia!\nSlăvit să fie El!',
    songKey: 'G',
  },
  song_last_slide: {
    main: 'Aleluia, Aleluia!\nMărire Domnului!\nAleluia, Aleluia!\nSlăvit să fie El!',
    amen: 'Amin!',
  },
  bible: {
    reference: 'Ioan 3:16',
    main: 'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viață veșnică.',
  },
  bible_passage: {
    reference: 'Psalmul 23:1-3',
    main: 'Domnul este Păstorul meu: nu voi duce lipsă de nimic. El mă paște în pășuni verzi și mă duce la ape de odihnă; îmi înviorează sufletul.',
  },
  announcement: {
    main: '<h1>Anunț Important</h1><p>Program special duminica viitoare!</p>',
  },
  versete_tineri: {
    person: 'Andrei Popescu',
    reference: 'Romani 8:28',
    main: 'De altă parte, știm că toate lucrurile lucrează împreună spre binele celor ce iubesc pe Dumnezeu.',
  },
  empty: {},
  screen_share: {},
  // A deck slide brings its own design: there is no layout to edit.
  deck_slide: {},
}

/** A slide type's sample, as the renderer takes it. */
export function sampleContentData(contentType: ContentType): ContentData {
  const sample = SAMPLE_CONTENT[contentType]
  switch (contentType) {
    case 'song':
    case 'song_first_slide':
    case 'song_last_slide':
      return {
        mainText: sample.main,
        songKey: sample.songKey,
        amen: sample.amen,
        songTitle: sample.songTitle,
        songTitleNumber: sample.songTitleNumber,
      }
    case 'bible':
    case 'bible_passage':
    case 'versete_tineri':
      return {
        contentText: sample.main,
        referenceText: sample.reference,
        personLabel: sample.person,
      }
    case 'announcement':
      return { mainText: sample.main }
    default:
      return {}
  }
}
