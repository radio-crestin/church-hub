import { useNavigateTemporary } from './usePresentationControls'

/** The program whose step is on the screens: next and previous walk it. */
export interface LiveProgramSteps {
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
}

/**
 * Moves what is on the screens one step, from any page: through the live
 * program when one is running (as the arrow keys do), else through the song
 * or chapter on the screens.
 */
export function useMoveLive(liveProgram: LiveProgramSteps | null) {
  const navigateTemporary = useNavigateTemporary()

  const move = (direction: 'next' | 'prev') => {
    if (liveProgram) {
      void (direction === 'next' ? liveProgram.goNext() : liveProgram.goPrev())
    } else {
      navigateTemporary.mutate({ direction })
    }
  }

  return {
    goNext: () => move('next'),
    goPrev: () => move('prev'),
    isMoving: navigateTemporary.isPending,
  }
}
