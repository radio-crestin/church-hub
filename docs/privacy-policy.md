# Church Hub privacy policy

*English below, then Romanian. In the app: Settings > Privacy (same text, with its list of events drawn from the code).*

The list of events and properties lives in one place in the code,
`app/apps/client/src/features/analytics/analyticsEvents.ts`; the client cannot send anything else (`sanitizeEvent.ts` drops any other event or property). Keep this file in step with it.

## English

Church Hub sends anonymous usage data so we can see how the app is used, find problems and improve it. It cannot tell who you are or which church you are.

### What we collect

**From the app window**

| Event | What it means | Sent with it |
| --- | --- | --- |
| `button_pressed` | A button, link, menu item, tab or switch was pressed | `element`, `container`, `role`, `icon`, `feature`, `route` |
| `shortcut_used` | A keyboard shortcut was pressed (never while typing in a field) | `shortcut`, `scope`, `feature`, `route` |
| `$pageview` | A page was opened | `feature`, `route` |
| `$pageleave` | A page was left | `route` |
| `app_started` | The app window started | nothing else |
| `startup_failed` | The app could not reach its server at start | `scope`, `status`, `attempts`, `boot_phase`, `boot_message`, `last_error`, `ever_reachable`, `total_wait_ms`, `user_agent` |
| `$exception` | An error in the app: its message, type and where in the code | `source`, `component` |
| `warning` | A problem that did not stop the app | `message`, `source`, `component` |
| `$snapshot` | A piece of the masked screen recording | nothing else |

**From the app's server**

| Event | What it means | Sent with it |
| --- | --- | --- |
| `app_started` | The server started | nothing else |
| `server_message` | A problem the server noticed | `level`, `message`, `source` |
| `$exception` | An error in the server: its message, type and where in the code | `source` |

**Sent with every event:** `distinct_id` (this device's random id), `route`, `install_id` (this installation's random id), `component` (client or server), `runtime` (desktop app or browser), `release` (the app's version), `environment`.

**Device and app:** the operating system and its version, the browser engine and its version, the screen and window size, the app's version and the PostHog library's version.

**Screen recording:** a recording of the app's screen (session replay), to understand problems. Every text and every field is masked: it shows only grey blocks where words were. Pictures and videos are left out. The projection screens (`/screen/…`) are never recorded, and PostHog is not even started there.

**What each detail means:** `element` is the button's code name (its test id or `data-analytics` name, numbers removed), never its text; `container` the code name of the area around it; `role` the kind of element; `icon` the name of its icon (for example `trash-2`); `feature` the part of the app (songs, bible, schedules…); `route` the page's pattern, like `/songs/$songId`, never the song or the address; `shortcut` the key combination, like `CommandOrControl+K`; `scope` whether it was pressed in the app or in another program.

### Why

To learn which features are used and which are not, to find buttons people press but that do not work, and to fix errors before they are reported.

### Where it goes

To PostHog, in its European Union cloud (Frankfurt, Germany). Nobody else gets it, and it is never sold.

### How long it is kept

As long as PostHog's plan for the project allows: about one year for events and errors, 30 days for screen recordings. Then it is deleted.

### How it stays anonymous

- Each device gets a random id (kept in the browser's storage), and each installation another one (kept next to the database, in `analytics.json`); neither is linked to your name, email, computer name or account. Before this, the server used the computer's name: it no longer does.
- No person profiles are created (`person_profiles: 'never'`, `$process_person_profile: false`), and `identify()` is never called.
- Your IP address is not stored: every event carries `$ip: null`, so PostHog does not fill it in, and `$geoip_disable: true`, so it is not used to find your location. The PostHog project's "Discard client IP data" setting is meant to be on as well.
- Web addresses and IP addresses (also local network ones) are removed from everything sent; the server also removes your home folder (it holds the computer's user name).

### What is never collected

The text of buttons and pages, song lyrics, Bible verses, programs and their items, anything you type, file and folder names, names, emails and passwords, your IP address or your network's addresses.

### How to turn it off

Settings > Privacy > **Share anonymous usage data** (on by default; needs the right to edit settings). From then on no event, error or screen recording is sent, neither by the app windows nor by the server, on every device connected to this app. A window that has heard it is off does not start PostHog at all on its next start; a new device sends nothing until it has asked the server.

## Română

Church Hub trimite date anonime de utilizare, ca să vedem cum este folosită aplicația, să găsim problemele și s-o îmbunătățim. Din ele nu se poate afla cine ești sau ce biserică ești.

### Ce colectăm

Aceleași evenimente și detalii ca în tabelele de mai sus (numele lor sunt cele din cod):

- `button_pressed`: a fost apăsat un buton, un link, un element de meniu, o filă sau un comutator.
- `shortcut_used`: a fost apăsată o scurtătură de tastatură (niciodată în timp ce scrii într-un câmp).
- `$pageview` / `$pageleave`: a fost deschisă / părăsită o pagină.
- `app_started`: fereastra aplicației (sau serverul) a pornit.
- `startup_failed`: la pornire, aplicația nu a putut ajunge la server.
- `$exception`, `warning`, `server_message`: erori și probleme, cu mesajul lor (fără adrese).
- `$snapshot`: o bucată din înregistrarea ecranului, cu textele ascunse.

Cu fiecare eveniment se trimit: id-ul aleatoriu al dispozitivului, id-ul aleatoriu al instalării, modelul paginii (de exemplu `/songs/$songId`), versiunea aplicației, sistemul de operare și versiunea lui, motorul browserului, dimensiunea ecranului și a ferestrei.

**Înregistrarea ecranului:** toate textele și toate câmpurile sunt ascunse (în locul cuvintelor apar doar blocuri gri); imaginile și clipurile video sunt lăsate deoparte. Ecranele de proiecție (`/screen/…`) nu sunt înregistrate niciodată.

### De ce

Ca să aflăm ce funcții sunt folosite și care nu, să găsim butoanele apăsate care nu funcționează și să reparăm erorile înainte să ne fie semnalate.

### Unde ajung

La PostHog, în cloudul său din Uniunea Europeană (Frankfurt, Germania). Nimeni altcineva nu le primește și nu sunt vândute niciodată.

### Cât timp sunt păstrate

Cât permite planul PostHog al proiectului: aproximativ un an pentru evenimente și erori, 30 de zile pentru înregistrările ecranului. Apoi sunt șterse.

### Cum rămân anonime

Fiecare dispozitiv primește un id aleatoriu, iar fiecare instalare altul; niciunul nu este legat de numele, e-mailul, numele calculatorului sau contul tău. Nu se creează profiluri de persoane. Adresa ta IP nu este păstrată și nu este folosită ca să afle unde te afli. Adresele web și adresele IP (și cele din rețeaua locală) sunt scoase din tot ce se trimite.

### Ce nu colectăm niciodată

Textul butoanelor și al paginilor, versurile cântărilor, versetele biblice, programele și elementele lor, nimic din ce scrii, nume de fișiere și foldere, nume, adrese de e-mail și parole, adresa ta IP sau adresele din rețeaua ta.

### Cum oprești trimiterea

Setări > Confidențialitate > **Trimite date anonime de utilizare** (pornit implicit; trebuie dreptul de a modifica setările). De atunci nu se mai trimite niciun eveniment, nicio eroare și nicio înregistrare a ecranului, nici din ferestrele aplicației, nici din server, pe toate dispozitivele conectate la această aplicație.
