# Ghid: cum scrii o descriere de PR excelentă

Scopul unei descrieri de PR: **orice reviewer să înțeleagă problema, de ce a
contat, soluția, deciziile de design și fiecare schimbare de
permisiuni / migrări / API / UI — fără să deschidă codul**. Descrierea se
scrie ca și cum ai fi autorul principal al feature-ului.

> În acest repo există și skill-ul automat `/detailed-pr` (în
> `.claude/skills/detailed-pr/`) care aplică acest ghid și deschide/actualizează
> PR-ul. Ghidul de față e referința umană: ce trebuie să conțină și de ce.

---

## Regula de aur: totul ancorat în diff

**Fiecare afirmație (endpoint, permisiune, migrare, coloană, număr de fișiere)
trebuie să provină din diff-ul și commiturile reale ale branch-ului.** Nu
inventa niciodată comportamente pe care diff-ul nu le conține. Dacă nu ești
sigur, inspectează codul — nu ghici.

## Pasul 1 — Adună faptele (rulează, nu lucra din memorie)

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=main
git fetch origin "$BASE" --quiet

git log --pretty='%h %s' "origin/$BASE..HEAD"     # commiturile
git diff --shortstat "origin/$BASE...HEAD"        # dimensiunea reală
git diff --name-only "origin/$BASE...HEAD"        # fișierele atinse
```

Apoi detectează zonele cu risc mare, care primesc secțiuni dedicate:

```bash
# Migrări + schimbări de schemă (citește fiecare migrare integral!)
git diff --name-only "origin/$BASE...HEAD" | grep -iE 'migration|db/schema'

# Permisiuni noi vs. pre-existente (doar nou aplicate)
git diff "origin/$BASE...HEAD" | grep -E '^\+' | grep -oE "'[a-z_]+\.[a-z_]+'" | sort -u

# Endpoint-uri noi/schimbate
git diff "origin/$BASE...HEAD" | grep -E '^\+' | grep -iE "url\.pathname ===|/api/"

# Suprafețe de UI noi
git diff --name-only "origin/$BASE...HEAD" | grep -iE 'components|hooks|service|routes'
```

Dacă branch-ul e în urmă față de bază, adu-l la zi înainte — o descriere plină
de conflicte induce în eroare.

## Pasul 2 — Structura (13 secțiuni, exact în această ordine)

Titlu: `<scop sau domeniu>: <rezumat scurt>` — compact, stil conventional.

```markdown
# <Titlul PR-ului>

### 1. Summary
Ce aduce PR-ul, în limbaj natural. Dacă are mai multe teme, enumeră-le.

### 2. Why
Problemele originale. Pentru FIECARE problemă:
- comportamentul anterior
- de ce era greșit/problematic
- un exemplu concret
- fluxurile de utilizator afectate
- impactul asupra produsului / utilizatorilor / operațiunilor

### 3. What changed
Împărțit pe zone funcționale (Bug fixes, Backend, Frontend, Permissions, API,
Database, Migrations, Refactors, UX). Pentru fiecare: intenție → implementare
→ efecte secundare relevante → compatibilitate înapoi. Citează hash-urile
commiturilor, grupate tematic.

### 4. Technical details
Servicii, hooks, endpoint-uri, query-uri, componente, guards, joburi noi.
Folosește tabele (| Kind | Name | Purpose |).

### 5. API changes
Endpoint-uri noi/schimbate, formate request/response, permisiuni necesare.
Folosește blocuri de cod (```http```).

### 6. Database changes
Tabele/coloane/indexuri/constrângeri/backfill-uri noi. Explică clar
compatibilitatea și strategia de rollback. Dacă nu există: „No database changes.”

### 7. Permissions / Authorization
Ce permisiuni există, ce acordă, cum interacționează cu cele existente.
Marchează fiecare: NEW vs EXISTING (doar nou aplicată). Tabele.

### 8. UI / UX changes
Schimbări vizibile: butoane noi, empty states, redenumiri, cazuri de view/edit.

### 9. Migration / Backfill strategy
Pentru fiecare migrare: exact ce face, de ce e sigură, de ce e idempotentă,
ce se întâmplă dacă rulează din nou.

### 10. Commit breakdown
Grupe tematice, fiecare cu `<hash> <subiect>`.

### 11. Test plan
Checklist cu checkbox-uri Markdown: happy paths, edge cases, regresie, matricea
de permisiuni, validare API / bază de date / migrări / UI. Marchează explicit
ce NU poate fi reprodus în mediul de dev (ex. comportament doar în aplicația
împachetată).

### 12. Risks
Riscuri pe axe: date, permisiuni, performanță, compatibilitate, UX — fiecare
cu mitigarea lui. Format tabel: | Risk | Mitigation |.

### 13. Out of scope
Explicit tot ce PR-ul NU face (previne review-uri despre lucruri neintenționate
și documentează deciziile de amânare).
```

## Cerințe de calitate (nenegociabile)

- **Fără rezumate vagi.** Dedu intenția arhitecturală din schimbările reale și
  explică raționamentul din spatele fiecărei decizii („de ce așa, nu altfel").
- **Adâncime unde e risc.** O migrare sau o schimbare de permisiuni primește
  întotdeauna secțiune completă — sunt cele mai riscante părți ale oricărui
  review. Acolo detaliul bate concizia.
- **Tabele** unde cresc claritatea; liste ierarhice; exemple concrete
  (un exemplu real de cântare/flux valorează cât trei paragrafe abstracte).
- **Omite cinstit.** O secțiune fără conținut real primește un rând scurt
  („N/A" / „No database changes.") — nu inventa conținut ca să umpli șablonul.
- **Gata de copy-paste** în GitHub, fără alte editări.
- Limba: conținut în engleză cu headerele de mai sus (convenția acestui repo).

## Capcane frecvente

| Capcană | Cum o eviți |
|---|---|
| Descrierea repetă titlurile commiturilor | Scrie despre *problemă și decizie*, nu despre „ce fișiere am atins" |
| „Added new endpoint" fără contract | Arată metoda, calea, request/response și cine are voie să-l cheme |
| Migrarea descrisă într-o propoziție | Spune ce ALTER/INSERT face, de ce e idempotentă și ce se întâmplă la re-rulare |
| Test plan generic („tested manually") | Checklist concret, reproductibil de altcineva, cu cazurile limită enumerate |
| Riscuri lipsă „ca să dea bine" | Orice PR are riscuri; a le numi + mitiga inspiră încredere, nu invers |
| Numere umflate/rotunjite | Ia cifrele din `git diff --shortstat`, nu din amintire |

## Pasul 3 — Publicare

```bash
git push -u origin "$BRANCH"

# creează SAU actualizează (niciodată duplicat)
gh pr view --json number -q .number >/dev/null 2>&1 \
  && gh pr edit "$(gh pr view --json number -q .number)" --body-file pr-body.md \
  || gh pr create --base main --head "$BRANCH" --title "<titlu>" --body-file pr-body.md
```

Convenții locale: autor unic (fără trailer `Co-Authored-By`), fără footer
„Generated with…".

## Exemplu de referință

PR [#45 — real-time Google Drive library sync](https://github.com/radio-crestin/church-hub/pull/45)
urmează integral acest format și poate fi folosit ca model.
