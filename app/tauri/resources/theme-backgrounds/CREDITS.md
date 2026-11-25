# Theme background credits

Every file here is free to use, commercially included, under its source's licence. No attribution is required by either licence; the credits below are a courtesy and a record of where each file came from.

- Unsplash License: https://unsplash.com/license
- Pexels License: https://www.pexels.com/license/

Unsplash offers no free videos (its search for "videos" returns only photos), so the motion backgrounds come from Pexels.

## Still backgrounds (Unsplash)

Downloaded from images.unsplash.com at 2400 px wide, then scaled and centre-cropped to 1920×1080 and re-encoded as JPEG with ffmpeg. No other edits.

| File | Subject | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| `mountain-sunrise.jpg` | Golden sunbeams over layered mountain silhouettes | Dmytro Yarish (https://unsplash.com/@dmytro_yarish) | https://unsplash.com/photos/golden-sunbeams-illuminate-layered-mountain-silhouettes-at-sunset-VvNz4khYfoQ | Unsplash License |
| `misty-forest.jpg` | Evergreen forest in fog | Dejan Zakic (https://unsplash.com/@dejanzakic) | https://unsplash.com/photos/misty-evergreen-forest-with-tall-trees-shrouded-in-fog-rr2EF3J5F2Y | Unsplash License |
| `golden-wheat.jpg` | Wheat field backlit at sunset | Benoît Deschasaux (https://unsplash.com/@benowa) | https://unsplash.com/photos/a-field-of-wheat-k1aKwgXB3u0 | Unsplash License |
| `calm-ocean.jpg` | Long-exposure calm sea under a golden horizon | Jonathan Bean (https://unsplash.com/@jonathanbean) | https://unsplash.com/photos/calm-sea-under-golden-clouds-ywnnwzcdR5o | Unsplash License |
| `starry-night.jpg` | Milky Way over a mountain silhouette, purple night sky | Tyler Clemmensen (https://unsplash.com/@tyler_clemmensen) | https://unsplash.com/photos/silhouette-of-mountain-under-starry-night-DQ_KYf1LF6E | Unsplash License |
| `sea-of-clouds.jpg` | Soft cumulus clouds in warm evening light | Łukasz Łada (https://unsplash.com/@lukaszlada) | https://unsplash.com/photos/sea-of-clouds-LtWFFVi1RXQ | Unsplash License |

## Motion backgrounds (Pexels)

Each one is a segment of the 1920×1080 Pexels file, re-encoded with ffmpeg as H.264 (High, yuv420p, `+faststart`, audio removed). To make it loop without a jump, the 2 seconds after the segment are crossfaded into its first 2 seconds, so the last frame flows into the first.

| File | Subject | Author | Source | Licence | Edits |
| --- | --- | --- | --- | --- | --- |
| `ocean-horizon.mp4` | Calm blue sea meeting a hazy sky | Engin Akyurt | https://www.pexels.com/video/blue-sky-and-blue-water-in-the-horizon-2915385/ | Pexels License | 18 s from 0:05; slowed 25 → 24 fps (4 %); looped to 16 s |
| `golden-clouds.mp4` | Clouds drifting over a golden sky | I Am Sorin | https://www.pexels.com/video/clouds-moving-on-yellow-sky-10753302/ | Pexels License | 18 s from 0:20; 30 fps; looped to 16 s |
| `forest-light-rays.mp4` | Light rays through a misty forest, slow walk forward | Roy Dieker | https://www.pexels.com/video/sun-light-shining-in-misty-forest-6554123/ | Pexels License | 18 s from 0:02; 30 fps; gently darkened (gamma 0.85, brightness −0.03); looped to 16 s |
| `blue-particles.mp4` | Abstract wave of blue light particles | Eugene Vasilevich | https://www.pexels.com/video/illustration-of-moving-particles-7101913/ | Pexels License | Slowed to 1.5× length with motion-interpolated frames (24 fps); gently darkened (gamma 0.85); looped to 13 s |
