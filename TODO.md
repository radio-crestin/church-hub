# TODO

Listă de task-uri extrase din feedback-ul de pe WhatsApp (15.03.2026 – 10.05.2026).
Fiecare item include contextul original și instrucțiuni concrete de implementare.

---

## 🎵 Cântări — Căutare & Indexare

- [ ] **Căutarea nu găsește "1. Cand Isus Hristos m-a mantuit"** *(22/03, 10/05)*
  - Repetat de două ori → bug confirmat de utilizator.
  - Instrucțiuni: normalizează query-ul de căutare — strip prefix numeric (`^\d+\.\s*`), strip diacritice (ă→a, î→i, â→a, ș→s, ț→t), case-insensitive. Verifică că FTS index conține titlurile cu și fără diacritice. Adaugă test e2e cu input-ul exact "1. Cand Isus Hristos m-a mantuit".

- [ ] **Căutarea nu caută în toate strofele (ex: refrenul nu e indexat)** *(30/04)*
  - Instrucțiuni: verifică `seed-songs` / pipeline-ul FTS — toate secțiunile (verse, chorus, bridge, refren) trebuie să fie indexate, nu doar versurile principale. Adaugă test cu un query care apare doar în refren.

- [ ] **Cântarea 265 (PDC) nu apare în căutare** *(29/03)*
  - Iosif a confirmat că PDC-urile sunt în program → e bug de indexare/filtrare.
  - Instrucțiuni: verifică că toate cântările PDC sunt seed-uite și apar în FTS. Caută în service-ul de seed dacă există filtru care le exclude.

- [ ] **X-ul din Search nu face focus pe input** *(26/03)*
  - Instrucțiuni: în componenta de search, după click pe X (clear), apelează `inputRef.current?.focus()`.

- [ ] **Input de search permanent în pagina unei cântări** *(26/04)*
  - Instrucțiuni: adaugă search box sticky în top-ul paginii de detalii cântare, ca utilizatorul să poată căuta fără să se întoarcă la lista de cântări.

---

## 📖 Versete & Biblie

- [ ] **Quick switch pentru afișarea traducerilor** *(12/04)*
  - Instrucțiuni: shortcut + buton vizibil în prezentare pentru a comuta rapid între traduceri (Cornilescu, NTR, etc.) fără să ieși din slide.

- [ ] **Când caut "Ps 25" focusează automat pe primul verset** *(05/04)*
  - Instrucțiuni: dacă query-ul nu specifică verset (`Ps 25` vs `Ps 25:3`), selectează automat versetul 1 și scrollează acolo.

- [ ] **In pagina cu programe, partea din stanga trebuie safie scrollable, si cea din dreapta sa ramana fixa** *(05/04)*
  - Instrucțiuni: la scrollIntoView, folosește `block: 'start'` cu un offset top (ex: 20% din viewport), nu `block: 'center'`.

- [ ] **Când se schimbă versetul, șterge adnotările** *(12/04)*
  - Instrucțiuni: în handler-ul de change verset, golește state-ul de adnotări (drawing/highlights) înainte de a randa noul verset.

- [ ] **Selecție de versete per subiecte, cu automatic slide** *(19/03)*
  - Instrucțiuni: feature nou — colecții tematice de versete (mântuire, credință, etc.). User selectează subiectul, aplicația generează slide-uri automat din versetele predefinite (aceasi functionalitate o are si BibleShow)

---

## 🎼 Cântări — Prezentare & Format

- [ ] **Salvează gamele în PowerPoint ca backup** *(15/03)*
  - Instrucțiuni: feature export — buton "Export to PPTX" pe nivel de cântare/program. Folosește o lib precum `pptxgenjs`. Păstrează formatul (font, poziție, culoare).

- [ ] **Testeaza importul pptx ca sa functioneze cum trebuie, drag and drop deasemenea sa functioneze bine** *(22/03)*

- [ ] **Importul e foarte lent** *(22/03)*
  - Instrucțiuni: profilează pipeline-ul de import. Posibil: parsing sincron, batch insert lipsă, FTS rebuild după fiecare insert. Soluție: batch upserts + rebuild FTS la final.

- [ ] **Drag and drop nu a funcționat cum trebuie** *(22/03)*
  - Instrucțiuni: vezi `FileDropZoneProvider.tsx` (există modificare uncommitted). Verifică că acceptă multiple files, toate tipurile suportate, și afișează feedback vizual la drag-over.

- [ ] **Split la versuri să se vadă mai mare** *(03/05)*
  - Instrucțiuni: pentru cântări lungi, split strofa în 2-3 slide-uri când depășește X linii, astfel încât fontul să poată fi mărit.

---

## 📺 Prezentare & Ecrane

- [ ] **Secțiune prezentări** *(09/04)*
  - Instrucțiuni: feature nou — secțiune dedicată în sidebar pentru prezentări (slide-uri custom, nu doar cântări/versete). Upload, edit, preview.

---

## 🔊 Audio & MIDI

- [ ] **Schedule automat la pornirea muzicii în funcție de timp** *(15/03)*
  - Instrucțiuni: feature — programare automată a unei cântări/playlist la o oră fixă. UI cu time picker + selecție track.

- [ ] **Când oprești aplicația, dă kill la player** *(26/03)*
  - Instrucțiuni: în handler-ul de app shutdown (Tauri `on_window_close` / `before-quit`), oprește toate playere active (audio sidecar, MIDI). Verifică că procesele copil sunt terminate.

- [ ] **Identifică MIDI după nume** *(16/04)*
  - Instrucțiuni: la conectare device MIDI, match după `device.name` nu doar după port index. Salvează preferințele utilizatorului pe device name.

- [ ] **dp solo se mută pe tineri când e cântare** *(12/04)*
  - Notă: posibil bug doar când treci direct de pe `[solo]` pe cântare (fără verset intermediar).
  - Instrucțiuni: verifică tranziția de scene OBS / preset mixer când treci de pe slide solo direct pe cântare.

---

## 📡 Live & Distribuție

- [ ] **La pornirea live-ului: focus pe pagină + dialog post WhatsApp** *(05/04)*
  - Instrucțiuni: când utilizatorul pornește live-ul, deschide automat un dialog cu link-ul de share + buton "Post on WhatsApp" (deep link `whatsapp://send?text=...`).
