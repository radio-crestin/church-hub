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
- adauga ecrane cu configurari default
- apoi implementeaza in ecranul versete biblice sa fie afisat slide-ul urmator pe stage monitor
- creaza o pagina numita LiveStream
- din aceasta pagina utilizatorul poate crea un nou livestream pe YouTube
- aici vor fi afisate scenele si poti schimba rapid intre ele
- integreaza un modul de a schimba scenele cu ajutorul unor shortcuts
- creaza un modul pentru a trigger shortcuts folosind midi devices
- acest modul trebuie sa permita afisarea state-ului curent in diferite locatii pe acel midi device (de exemplu, scena curenta va aprinde bec-ul unui anumit buton)
- creaza mecanismul de schimbare scene in functie de tipul de slide afisat (de exemplu cand este un verset biblic tineri, sa se schimbe pe scena SOLO)
- creaza un modul de control al mixerului, astfel incat fiecare scena va da mute/unmute la anumite canale audio
- inlocuieste aplicatia de scene monitor cu una care foloseste aplicatia turso si un UI similar cu cel al aplicatiei actuale
- pentru Biblie va trebui sa afisezi in timp real ce se cauta pe pc-ul principal si sa afisezi lista de versete
- pentru cantari, va fi ceva similar, fiecare cantare e echivalentul unui verset
- adauga un ecran de customizare a prezentarii, dimensiune fonturi, culori, fundaluri, etc
- adauga in setari un link catre openapi
- implementeaza system token api 
- implementeaza api-uri pentru search cantari, adaugare de cantari, programe, camera de control, preview, current queue, etc.
