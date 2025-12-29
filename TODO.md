~~- adauga optiunea de a importa o arhiva zip cu mai multe fisiere in care utilizatorul va avea posibilitatea sa aleaga categoria in care sa fie importate fisierele~~
~~- adauga optiunea de a importa OpenSong XML~~
~~- imbunatateste algoritmul de search~~
~~- importa toate cantarile existente din PPTX~~
~~- adauga optiunea de a da export in format OpenSong XML~~
~~- implementeaza OpenBible XML (import, serch, etc)~~
  ~~- better ui~~
~~- imbunatateste viteza de import pentru cantarile de pe resurse crestine~~
~~- implementeaza sistemul de permissioning cu link de autentificare~~
~~- modifica adauga in coada cu adauga in program~~
~~- adauga optiunea de a salva coada actuala ca si un program~~
~~- in butonul adauga, adauga optiunea de a adauga versete biblice~~
~~- adauga in versete tineri referinte catre versete~~
~~- fa meniul lateral configurabil din setari (muta butonul de setari in partea de jos)~~
~~- adauga link catre WhatsApp in sidebar~~
~~- rezolva problema cu schimbul temei si muta acest meniu in setari~~
~~- rezolva problema cu selectorii, implementand ceva custom~~
~~- imbunatateste creare de ecrane, lasand utilizatorul sa aleaga intre (ecran prezentare principal, stage monitor, livestream overlay)~~
~~- adauga o pagina de editare si configurare a fiecarui tip de ecran~~
~~- adauga ecrane cu configurari default~~
~~- apoi implementeaza in ecranul versete biblice sa fie afisat slide-ul urmator pe stage monitor~~
~~- creaza o pagina numita LiveStream~~
~~- din aceasta pagina utilizatorul poate crea un nou livestream pe YouTube~~
~~- aici vor fi afisate scenele si poti schimba rapid intre ele~~
~~- integreaza un modul de a schimba scenele cu ajutorul unor shortcuts~~
~~- adauga optiunea de a configura ce sceva sa se selecteze la start, stop~~
~~- creaza shortcuts pentru start/stop stream, cauta cantari, cauta Versete~~
~~- creaza un modul pentru a trigger shortcuts folosind midi devices~~
~~- acest modul trebuie sa permita afisarea state-ului curent in diferite locatii pe acel midi device (de exemplu, scena curenta va aprinde bec-ul unui anumit buton)~~ - needs to be tested
- ~~creaza mecanismul de schimbare scene in functie de tipul de slide afisat (de exemplu cand este un verset biblic tineri, sa se schimbe pe scena SOLO)~~
~~- creaza un modul de control al mixerului, astfel incat fiecare scena va da mute/unmute la anumite canale audio~~
~~- creaza o conexiune permanenta in youtube~~
~~- adauga un ecran de customizare a prezentarii, dimensiune fonturi, culori, fundaluri, etc~~
~~- adauga in setari un link catre openapi~~
~~- implementeaza system token api~~
~~- reorganizeaza pagina de setari si deasemenea asigura-te ca pagina web ascunde setarile disponibile numai in turso~~
~~- fa build pe windows si testeaza aplicatia~~
~~- pentru cantari si versete Biblice, nu adauga in queue ci doar afiseaza-le~~
~~- foloseste numele display-ului in titlu~~
~~- ascunde window-urile de screen din bara din OS~~
~~- remove from screens the loading animation..~~
~~- fix screen url in production~~
~~- rezolva problema cu youtube login, cel mai probabil va trebui sa facem deploy la propriul server astfel incat aplicatia sa nu aiba nevoie de secret keys~~
~~- fix livestream font size~~
~~- implementeaza in livestream sa se puna 2 linii pe aceasi linie daca incape~~
~~- implementeaza real transparent background, chiar si cand este dark mode~~
~~- deasemenea, incepe intotdeauna cu coada goala~~
~~- asigura-te ca paginile web au reconnect cu websocket and when disconnected display an empty screen (with transparent bg or black)~~
~~- creaza o sectiune pentru a face backup la sqlite db si deasemenea de a vedea path-ul catre db~~
~~- do not display "YouTube not connected, OBS Disconnected""~~
~~- cand dau dezactivare la un screen, sa se inchida fereastra respectiva~~
~~- deasemenea, butonul de full screen nu functioneaza~~
~~- optimistic scene change~~
~~- fa listen pe orice port 3000~~
~~- rezolva problema cu generarea titlului, elimina orice alt caracter in afara de litere si -~~ 
~~- imbunatateste performanta aplicatiei~~
~~- debug why the web server is slow when accessed externally~~
~~- inlocuieste aplicatia de scene monitor cu una care foloseste aplicatia turso si un UI similar cu cel al aplicatiei actuale~~
  ~~- pentru cantari, va fi ceva similar, fiecare cantare e echivalentul unui verset~~
  ~~- pentru Biblie va trebui sa afisezi in timp real ce se cauta pe pc-ul principal si sa afisezi lista de versete~~
~~- adauga wake lock pentru intreaga aplicatie, nu numai pentru kiosk~~
~~- fix clock position to be the same as other things~~
~~- imbunatateste search-ul ca sa fie super rapid~~
~~- adauga optiune de a creste font-ul default al aplicatiei~~
~~- adauga buton pentru a salva shortcuts pe desktop (atat pentru cantari cat si pentru programe)~~
- ~~adauga optiunea de a edita programul ca si text~~
~~- adauga optiunea pentru a deschide opensong xml files~~ 
~~- si apoi seteaza luminiozitatea la 0 daca conexiunea websocket nu este available 5 minute~~
~~- implementeaza api-uri pentru search cantari, adaugare de cantari, programe, camera de control, preview, current queue, etc.~~
~~- in versiunea mobila a site-ului, asigura-te ca totul este scalabil corect~~
~~- rezolva problema cu scaling-ul din camera de control~~
~~- elimina slide-urile din pagina programului~~
- rezolva problema cu versete tineri si anunturi
- fa configurabil dacă sa fie always on top
- (optional) exportă ca și pptx întreg programul său fiecare cantare
- cand faci export, lăsa utilizatorul să aleagă dacă vrea un zip sau un folder
- importul din resurse creștine nu trebuie să facă override la cântările modificate
- dezactivează tunelul cloudflare pt portul 3000
- când se editează o cantare, modifica importa din text ca să se numească editează ca și text
- deasemenea, fă pagina mobile responsive
- adauga Amin la fiecare cantare
- fix openapi endpoints and fix authentication layer
- creaza optiunea de a adauga live-urile create intr-un playlist pe YouTube
- adauga posibilitatea de a face highlight pentru sesiunea curenta
- adauga o iconita pentru fisierele atasate Church Hub
- fix drag and drop pentru fisiere si apoi implementeaza export/import din pptx
- adauga optiunea de a deschide fisiere pptx direct in ChurchHub

