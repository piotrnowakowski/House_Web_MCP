# nowe mpzp — wariant 2

## Gęsty szpaler, otwierany dach jacuzzi i komin — r6, 21.10.2026

Na podstawie czerwonego zaznaczenia użytkownika usunięto 11 tui przy tarasie, wiacie i warzywniku oraz pięć tylnych drzew owocowych (fruit-08–12). Zachowano siedem owocowych po prawej, 11 drzew geodezyjnych i tuje przy palenisku. Pozostałe 31 tui przy ogrodzeniu zachowują pozycje i ref; między nimi dodano 115 sztuk, z docelowo zachodzącymi koronami w szpalerze co ok. 0,85–0,95 m. Nie wypełniano odcinka z siedmioma drzewami owocowymi. 65 kolidujących traw przesunięto przed szpaler; wszystkie 117 traw zachowano. Razem: **283 rośliny, w tym 148 tui**. Nie pomniejszano docelowych wymiarów: tuje 4,6 × 1,3 m, trawy 1,8 × 0,6 m.

Trawnik ma delikatnie bardziej zielony tint `#B7D7A5`, zapisany tylko w strefach tego wariantu; zimowe przebarwienie pozostaje sezonowe. Zachowano dotychczasowe obrysy trawnika, a pięć usuniętych mis i dawny podest pieca wypełniono osobnymi strefami trawy. Pozostałe nawierzchnie i ich ref bez zmian.

Wiata zachowuje ref i obrys 7,4 × 15,2 m. Nad jacuzzi ma otwór **2,9 × 3,85 m** z sześcioma rozsuwanymi panelami na prowadnicach, domyślnie odsłonięty. Po wybraniu wiaty przycisk „Zasłoń/Odsłoń dach nad jacuzzi” zmienia wyłącznie podgląd; stan osłony resetuje się po otwarciu sceny. Pozostały dach jest stały. Piec przeniesiono z przodu na tył kuchni, pozycja (14,2; 21,6 m), otworem ku trawnikowi. Pionowy komin za kopułą ma w modelu wysokość **4,2 m**, przechodzi przez otwór w stałym dachu z metalowym kołnierzem. To koncepcja: średnica, ciąg, izolacja, odstępy od drewna/roślin, wylot, niepalne podłoże oraz konstrukcja i odwodnienie osłony wymagają projektu do konkretnego urządzenia.

Źródło: canonical/shared r5, serverVersion 4; snapshot `before-garden-refine-r5.json` oraz pierwsza baza `initial-r1.json` pozostają niezmienne. Kopie rzeczywistych plików IndexedDB Chrome Default i Codex IAB: `tmp/garden-refine-20261021/`. Niezmienione magazyny odczytano z wcześniejszego eksportu wyłącznie po porównaniu wszystkich hashy plików; aktualny publiczny origin odczytano bezpośrednio przez przeglądarkę. Publiczny wariant r6/baza5 odpowiadał canonical r5 i scalał się bez konfliktów. Lokalny origin 127.0.0.1 zachowano przed zmianą jako surową kopię; bieżący odczyt wykonano po migracji. Wspólne architekt i pierwszy MPZP są zgodne ze swoimi bazami i nie są zmieniane.

Przeszły **604 testy / 112 plików**. Testy obejmują usunięcia po scaleniu i ponownym odczycie, granice, wolne przejścia i docelowe korony; nakładanie koron dopuszczono wyłącznie między tujami szpaleru. W rzeczywistej scenie dziewięć promieni nad wodą nie trafia w odsłonięty dach, a wszystkie dziewięć trafia po zasłonięciu. Komin ma zmierzone 4,2 m i w osi przejścia trafia tylko w metalowy kołnierz, bez drewna. Budynki i główne dachy są identyczne z r5; ponowne obliczenia dały 38,809709° / 39,235237°, wspólną kalenicę 8,085694 m i rozpoznany styk, garaż 37° i 5,758530 m. Dowody: `roof-scene-audit.json`, `roof-check.json` i logi w katalogu kopii. Nie wykonywano projektu konstrukcyjnego ani instalacyjnego.

## Tuje i wysokie trawy w całym ogrodzie — r5, 20.10.2026

Na podstawie nowego zdjęcia z zaznaczonymi rabatami zastąpiono wszystkie pozostałe **42 hortensje i 41 lawend**. Przy ogrodzeniu, palenisku i spa tuje tworzą powtarzalne pionowe akcenty, rozdzielone wysokimi trawami. Przed środkową częścią przeszklenia tarasu i wzdłuż grządek jest przewaga traw; tuje stoją na końcach i wybranych narożnikach. Nowa paleta obejmuje **44 tuje Szmaragd** (docelowo 4,6 m wysokości, rezerwa szerokości 1,3 m) i **117 trzcinników Karl Foerster** (1,8 × 0,6 m). To zachowane wcześniej przyjęte gatunki i wymiary, nie nowy dobór odmian ani wielkość sadzonek.

Wszystkie 83 zastępowane rośliny zachowują pozycje i `ref`; nowe korony są mniejsze od poprzednich. Nie dodano ani nie usunięto miejsc sadzenia: nadal 184 rośliny, w tym niezmienione 11 drzew geodezyjnych i 12 owocowych. Pozostałe 101 roślin, nawierzchnie, meble, pełna wiata i budynki są identyczne z r4. Bilans powierzchni pozostaje bez zmian. Weryfikacja obejmuje docelowe korony, odstępy od ścieżek, tarasów i granic, a także zachowanie lokalnego usunięcia zastępowanej rośliny.

Źródło: canonical/shared r4, serverVersion 3. Snapshot poprzedniej publikacji: `before-all-thuja-grass-r4.json`; niezmienna pierwsza baza `initial-r1.json` zachowana. Rzeczywiste Chrome Default i Codex IAB oraz wspólne dane trzech aktywnych projektów skopiowano do `tmp/all-thuja-grass-20261020/`. Publiczna kopia wariantu r5/baza4 i lokalna r8/baza4 scalały się bez konfliktów z canonical r4. Starszy lokalny konflikt bramy pierwszego MPZP pozostawiono poza zakresem pracy.

Przeszły **603 testy / 112 plików**, lint, build frontendu i API oraz kontrola sekretów. Dobór do rzeczywistej gleby, wilgotności i nasłonecznienia wymaga potwierdzenia przed zakupem roślin; nie wykonano nowego pomiaru tych warunków.

Publikacja r5 na Mikrusie potwierdzona: kod **a5e00bf42e72557faac7f10bea7506eb056f93cf**, canonical **r5**, shared **serverVersion 4**, zapis z expectedVersion=3 i identyczny odczyt zwrotny. Wspólne architekt i pierwszy MPZP pozostały identyczne. Publiczne health/API są poprawne, a SHA256 głównego pliku JS zgadza się z lokalnym buildem. Świeży origin testowy otrzymał r5, istniejący lokalny r9, istniejący publiczny HTTPS r6; wszystkie odpowiadają canonical r5 przy tolerancji 1e-9 dla normalizacji liczb. Kolejne odświeżenie zachowało publiczny workspace dokładnie, bez błędów konsoli.

W rzeczywistej scenie sprawdzono komplet 161 roślin ozdobnych: 44 tuje o wysokości 4,6 m i 117 traw o wysokości siatki ok. 1,745 m w rezerwie 1,8 m. Kadry publiczne: `output/all-thuja-grass-20261020/mikrus-ogrod.png` i `mikrus-rabaty.png`; podgląd pozostawiono na całym ogrodzie. Dowody, kopie i wyniki publikacji: `tmp/all-thuja-grass-20261020/`. Nie powtarzano testów niezmienionych wnętrz ani testu na fizycznym iPhonie. Po publikacji VPS ma **201 MB wolnego / zaokrąglone 100% zajęcia**; kolejne większe wdrożenie wymaga uporządkowania miejsca. Main i GitHub Pages bez zmian.

## Taras i wspólna wiata kuchni ze spa — r4, 20.10.2026

Na podstawie trzech zdjęć użytkownika zamieniono miejsca zestawów: wypoczynek stoi przed przeszkleniem (−5,1; 9,45 m, obrót 180°), a stół z sześcioma krzesłami w bocznej części tarasu (−11; 7,65 m). Wspólne modele mebli poprawiono u źródła: siedziska są skierowane do stołów, oparcia na zewnątrz; poprawka dotyczy również stołu kuchni letniej. Zostaje około 1,2 m między sofą a przeszkleniem. Realna obwiednia wypoczynku to 3,645 × 2,452 m, stołu z krzesłami 2,25 × 2,453 m.

Oba tarasy otrzymują jasne deski Hinoki z tej samej tekstury co naturalna część elewacji; wiata i ściany sauny używają tej samej palety drewna. Ściany domu pozostają bez zmian, z dotychczasowym lekkim zabarwieniem tekstury. Ażurową pergolę zastępuje wiata **7,4 × 15,2 × 3,1 m**, zachowująca `fixture/nowe-mpzp-v2/pergola`. Ciągły szczelny w modelu dach ma grafitowe pokrycie oraz drewniany spód i obramowanie. Obejmuje kuchnię, przejście, jacuzzi i saunę; dziesięć słupów pozostaje poza wyposażeniem. Prześwit między belkami a dachem sauny wynosi 0,21 m. Piec do pizzy pozostaje poza zadaszeniem, przed wiatą. To koncepcja: rozpiętości, przekroje, fundamenty, spadek odwodnienia oraz wentylacja i odstępy grilla wymagają projektu wykonawczego. Lokalizacja w 18.R3.1 nadal jest warunkowa; brak nowej oceny prawnej.

`before-terrace-canopy-r3.json` zachowuje poprzednią publikację r3; pierwotna baza migracji `initial-r1.json` pozostaje niezmienna. Wszystkie 184 rośliny, w tym tuje i trawy, oraz geometria domu, garażu i ich dachów są identyczne z r3. Rzuty nawierzchni pozostają identyczne, więc bilans MU r2 nie zmienia się; nowy dach leży w koncepcyjnej części R3. Starsze opisy pergoli poniżej dokumentują stan r2/r3.

Przed edycją skopiowano rzeczywiste profile Chrome Default i Codex IAB oraz trzy wspólne workspace z HTTPS do `tmp/terrace-canopy-20261020/`. Publiczny wariant miał lokalne r4/bazę3, shared r3/serverVersion2 i treść zgodną z canonical r3. Lokalny wariant r7/baza3 scalał się bez konfliktów. Wcześniejsze konflikty bramy/caveats lokalnego pierwszego MPZP zachowano poza zakresem pracy. Wszystkie stabilne ref zachowano. Testy migracji chronią lokalne usunięcie przenoszonego stołu i niezależne przesunięcie jacuzzi.

Przeszło **602 testy / 112 plików** i lint. W rzeczywistej scenie 3D sprawdzono kierunek wszystkich 15 siedzisk obu stołów i wypoczynku, brak kolizji dziesięciu słupów z wyposażeniem, gabaryty dachu i prześwit nad sauną. Dowód: `tmp/terrace-canopy-20261020/scene-assertions.json`. Przeliczenie istniejących dachów daje 38,809709° / 39,235237°, wspólną kalenicę 8,085694 m i rozpoznany styk skrzydeł; garaż 37° i kalenica 5,758530 m. Geometria domu nie była zmieniana. Build frontendu i API oraz kontrola sekretów przeszły.

## Tuje i trawy — r3, 20.10.2026

Na podstawie zaznaczenia na zdjęciu użytkownika zmieniono ciągłą wschodnią rabatę przy ogrodzeniu, od garażu przez kuchnię letnią do spa (z od −7 do ok. 30 m). Dziewięć hortensji zastąpiono tujami Szmaragd, dziewięć lawend trzcinnikami; istniejące trawy przesunięto i dodano dziewięć kęp, tworząc dziewięć grup po trzy trzcinniki pomiędzy tujami. Tuja co ok. 4,2 m jest pionowym akcentem; trawy w trójkątach dają niższą, powtarzalną warstwę. Razem w tej części: **9 tui i 27 traw**, w całym projekcie **184 rośliny**, w tym 161 ozdobnych.

W modelu tuja `Thuja occidentalis 'Smaragd'` ma docelowo **4,6 m wysokości i Ø1,3 m**, z zaokrągleniem rezerwy szerokości w górę względem 15 ft × 3–4 ft podanych przez [szkółkę Monrovia](https://www.monrovia.com/emerald-green-arborvitae.html). Trzcinnik Karl Foerster zachowuje **1,8 × 0,6 m** ([RHS Plants](https://rhs.crocdn.co.uk/plants/_/calamagrostis--acutiflora-karl-foerster/classid.2000012392/)). To docelowa skala, nie wielkość sadzonek; rzeczywisty wzrost zależy od stanowiska i pielęgnacji. Dobór wymaga potwierdzenia nasłonecznienia, wilgotności i gleby. Wszystkie pozostałe nasadzenia, wyposażenie, nawierzchnie, budynki i dachy zachowano bez zmian. Bilans powierzchni r2 pozostaje aktualny.

`before-thuja-r2.json` zachowuje poprzednią publikację; `initial-r1.json` pozostaje niezmienną bazą pierwszej migracji. Stabilne identyfikatory zastępowanych roślin zachowano. Przed pracą skopiowano rzeczywiste profile Chrome/IAB i wspólne dane do `tmp/thuja-border-20261020/`. Lokalny wariant r6/baza2 oraz publiczny HTTPS r2/baza2 były zgodne z kanonicznym r2, bez konfliktów. Pozostałych projektów nie nadpisano.

Przeszło 601 testów w 112 plikach, lint, build frontendu i API oraz kontrola sekretów. Sprawdzono odstępy koron, granic i przejść oraz zachowanie lokalnego usunięcia zastępowanej rośliny z jawnym konfliktem zamiast jej odtworzenia.

Osobny projekt `project/nowe-mpzp-v2`, przygotowany 20.10.2026 na podstawie ilustracji „Ogród — koncepcja zagospodarowania” przekazanej przez użytkownika. Kanoniczna rewizja: **6**. Na [Mikrusie](https://natan203-20203.mikrus.cloud/) wybierz **Projekty → nowe mpzp — wariant 2**.

## Układ i skala

Zachowano dom, garaż, wiatę, wszystkie dachy i wnętrza, działki, ogrodzenie, bramy oraz 11 istniejących drzew z mapy. Nie zmieniono wysokości ani geometrii budynków. Układ ogrodu przeniesiono na rzeczywistą działkę: drewniany taras przy domu, palenisko po prawej, kuchnia letnia pod pergolą, jacuzzi i sauna, dalej szklarnia z sześcioma grządkami, sad i centralny otwarty trawnik. Rzeczywiste metry powodują większe odstępy i więcej trawnika niż na poglądowej ilustracji.

Ilustracja nie ma skali ani nazw produktów i gatunków. Poniższe gabaryty są przyjętymi wymiarami koncepcyjnymi, nie pomiarami z fotografii ani specyfikacją produktów do zakupu.

| Element | Wymiary w modelu |
| --- | --- |
| Placyk paleniska | Ø6 m; misa Ø1,5 m |
| Pergola kuchni | 5 × 7 × 2,7 m; dach ażurowy |
| Grill, zlew i blat | 3,6 × 0,8 m; wysokość modelu do 1,28 m |
| Piec do pizzy | 1 × 1,05 × 2,1 m, poza pergolą |
| Jacuzzi | Ø2,4 m; wysokość ok. 1,15 m; obrys ze schodkami 2,4 × 2,9 m |
| Sauna | 2,5 × 3 × 2,5 m |
| Szklarnia | 4,14 × 3,2 m |
| Sześć grządek | po 2,4 × 1,2 m; przejścia 1–1,4 m |
| Główne ścieżki | szerokość 1,4 m |
| Płyty między spa i warzywnikiem | 1,2 × 0,55 m; odstęp 0,15 m |
| Pomost kuchni i spa | 7,8 × 17 m |
| Zestaw wypoczynkowy | rezerwacja katalogowa 3,8 × 3,1 m; sam model ok. 3,6 × 2,43 m |
| Zestawy jadalniane | rezerwacja katalogowa 3,4 × 2,5 m; sam model ok. 2,25 × 2,36 m |

W pierwotnej rewizji r2 w rabatach umieszczono **152 roślin**, modelowanych w docelowych rozmiarach:

- Hortensja bukietowa Little Lime: wysokość i szerokość 1,5 m. Zakres hodowcy 0,9–1,5 m: [Proven Winners](https://www.provenwinners.com/plants/hydrangea/little-lime-panicle-hydrangea-hydrangea-paniculata).
- Trzcinnik Karl Foerster: wysokość 1,8 m, szerokość 0,6 m: [RHS Plants](https://rhs.crocdn.co.uk/plants/_/calamagrostis--acutiflora-karl-foerster/classid.2000012392/).
- Lawenda Hidcote: wysokość 0,5 m, szerokość 1 m, czyli górne wartości zakresu [RHS](https://www.rhs.org.uk/plants/96353/lavandula-angustifolia-hidcote/details). Wymaga przepuszczalnego, słonecznego i osłoniętego stanowiska. Przyjęcie odmiany wymaga sprawdzenia warunków miejscowych.

Dobór gatunków jest interpretacją charakteru rabat, nie identyfikacją zdjęcia. Zachowano 12 miejsc na drzewa owocowe: siedem po prawej co 4,2 m i pięć z tyłu co 6 m. Rezerwacja każdego drzewa to korona Ø3,2 m i wysokość 3,5 m; odmiany i podkładki trzeba dobrać do tych rozmiarów. Rewizja r2 zawierała **175 roślin** (152 ozdobnych, 12 owocowych, 11 geodezyjnych) i **23 elementy wyposażenia**, wliczając osobne skrzynie i grupy upraw.

## Źródło i zachowanie danych

- Źródło: `project-data/nowe-mpzp/project.json`, r19, identyczne z odczytem HTTPS shared `serverVersion=15`, wykonanym przed pracą.
- `source-nowe-mpzp-r19.json` to niezmienny snapshot źródła, SHA256 `6A12C08F75BBE49C7B7115925264C9A9783FA7DEA7BAC060DB71CE8480BB828A`.
- `initial-r1.json` to zachowana pierwsza lokalna wersja i baza migracji, SHA256 `947CE5B11BDF4D0387A73A31EE1199F1DC5C51D5C24944D65A84B6609FF884A1`. Nie zastępować jej kolejnymi rewizjami.
- Istniejące przeniesione elementy zachowują swoje `ref`; nowe elementy mają prefiks `nowe-mpzp-v2`. Pierwszy projekt `nowe mpzp` i pozostałe projekty pozostają niezależne.
- Rzeczywiste profile Chrome Default oraz Codex IAB skopiowano do `tmp/nowe-mpzp-v2-20261020/{chrome,iab}-before`. Kopie są ignorowane przez Git. Żadnego oryginalnego profilu nie resetowano.
- Porównania według `ref` i baz: publiczne kopie HTTP r3/baza3 i HTTPS r8/baza7 scalają się z r19 bez konfliktów. Wcześniejsze lokalne konflikty bramy i `caveats` pierwszego projektu na `http://127.0.0.1:5173` są zachowane w kopii i nie zostały użyte do nadpisania danych źródła. Wyniki: `tmp/nowe-mpzp-v2-20261020/source-comparison.json`.
- Kanoniczny model r2 jest zgodny treściowo z zapisanym lokalnym wariantem r6; numer przeglądarkowy zwiększył się podczas kolejnych migracji roboczych. Potwierdzono odczyt IndexedDB po ponownym otwarciu. Różnice ograniczają się do metadanych rewizji i daty.

Generator: `npx tsx scripts/build-nowe-mpzp-v2.ts`. Czyta zachowane źródło, sprawdza schemat, geometrię i położenie wyposażenia; nie modyfikuje pierwszego wariantu.

## Weryfikacja i ograniczenia

Przeszło 60 testów w `publishedNoweMpzpV2`, `publishedNoweMpzp`, `webmcp` i `textures`, a także `npm run lint` oraz `npm run build`. Testy obejmują niezależność projektów, zachowanie usunięć i zmian nazwy po synchronizacji, brak odtwarzania skasowanego wariantu, niezmienione budynki i drzewa geodezyjne oraz prześwity roślin przy ścieżkach. W rzeczywistym podglądzie zmierzono obwiednie nowych modeli 3D pergoli, sauny, jacuzzi i pieca. Panel wyboru projektów nadal zgłasza wcześniejsze ostrzeżenia React o powielonych kluczach listy konfliktów pierwszego wariantu; nie zmieniano tych konfliktów. Zdjęcia i odczyt danych: `output/nowe-mpzp-v2-20261020/`.

Bilans roboczy `balance-r2.json`: część MU 888,8065 m², obrys zabudowy 237,7607 m², ostrożnie liczona zieleń 501,7281 m² (56,4496%). Drewno, żwir, gabaryty wyposażenia i pas 0,20 m przy ogrodzeniu wyłączono z PBC. To obliczenie koncepcyjne, nie bilans zatwierdzonego projektu.

Sauna, pergola i szklarnia leżą w koncepcyjnej części **18.R3.1**. Ich lokalizacje pozostają warunkowe w świetle zapisanej analizy projektu planu; odtworzenie zdjęcia nie rozstrzyga dopuszczalności realizacji. Nie wykonywano nowej analizy prawnej, projektu konstrukcyjnego, fundamentów, instalacji, pożarowego ani szczegółowego doboru roślin do gleby i zacienienia.

## Publikacja na Mikrusie — 20.10.2026

Na wyraźne polecenie użytkownika opublikowano kod `02e362214e002650048a560e865ae57366f8d867` z `codex/deploy-furnished-zielonki` oraz canonical r2 / shared serverVersion 1. Nowe kopie rzeczywistych Chrome/IAB i porównania 32 zapisów: `tmp/nowe-mpzp-v2-release-20261020/`. Lokalny wariant r6 był zgodny treściowo z canonical r2, bez konfliktów i dodatkowych propozycji. Wspólny wariant utworzono z `expectedVersion=0`; odczyt zwrotny był identyczny z przygotowanym workspace. Wspólne dane nowe-mpzp, architekt, Główny i paulinka poprawki pozostały identyczne z kopiami sprzed publikacji. `main` i GitHub Pages pozostają bez zmian.

Przeszło 598 testów / 112 plików, lint, build frontendu oraz API i kontrola sekretów. Publiczne health/API są poprawne, a SHA256 pobranego pliku JS odpowiada lokalnemu buildowi. Sprawdzono widoczność projektu w launcherze, otwarcie w rzeczywistym profilu IAB i ponowne otwarcie po odświeżeniu. IndexedDB r2 jest dokładnie zgodne ze wspólnym workspace serverVersion 1. Dowody: `release-verification.json`, `browser-after-reload.json`, `shared-after.json` i `deployment-result.json` w katalogu kopii wydania. Nie powtarzano pełnych testów przeglądarkowych niezmienionych wnętrz.

Pierwszy build kandydata przerwał brak miejsca, bez przełączenia działającego wydania. Usunięto wyłącznie siedem nieużywanych rekordów cache źródeł tego projektu, sprawdzonych względem zachowanych katalogów wydań (łącznie ok. 587 MB); obrazy, woluminy, bazy i wydania pozostawiono. Powtórzona publikacja przeszła. Po publikacji `df -h /` pokazuje **428 MB wolnego / 99% zajęcia**; serwer wymaga osobnego uporządkowania miejsca przed kolejnymi większymi wdrożeniami.

## Potwierdzenie publikacji r3

Opublikowano na Mikrusie kod **28b75ee67a46aadf0d58ae0942d5c85cde8bffa4**, canonical **r3**, shared **serverVersion 2**. Wspólny workspace zapisano z kontrolą expectedVersion=1, a odczyt zwrotny był identyczny z żądaniem. Wspólne architekt i nowe-mpzp pozostały identyczne. Świeży origin testowy otrzymał r3/184 rośliny; rzeczywisty istniejący HTTPS otrzymał r4/184 po migracji. Treść obu zgadza się z canonical przy tolerancji 1e-9 m dla istniejącej normalizacji liczb; numer rewizji i data są metadanymi lokalnymi. Drugi reload zachował publiczny workspace dokładnie, bez nowych błędów konsoli. Publiczny plik JS ma identyczny SHA256 jak lokalny build, health wskazuje właściwy commit. Kadr publiczny: `output/thuja-border-20261020/mikrus-border.png`; dowody i kopie: `tmp/thuja-border-20261020/`.

Przed publikacją zwolniono 130 782 277 bajtów przez usunięcie trzech zbędnych paczek uploadu wyłącznie po porównaniu każdego pliku z zachowanym wypakowanym wydaniem. Bazy, obrazy, katalogi wydań i dwie ostatnie paczki pozostawiono. Po nowym wdrożeniu VPS ma **144 MB wolnego**; potrzebne jest osobne uporządkowanie miejsca przed kolejną publikacją. Main i GitHub Pages pozostają bez zmian.

## Publikacja r4 na Mikrusie

20.10.2026 opublikowano kod **cadfc7b6fffcf17b6884f77c8af623301f46fdf9**, canonical **r4**, shared **serverVersion 3**. Zapis wspólny użył expectedVersion=2; odczyt zwrotny jest identyczny z przygotowanym żądaniem. Wspólne architekt i pierwszy wariant MPZP pozostały identyczne z kopiami sprzed pracy. Health frontendu/API oraz SHA256 publicznego pliku JS potwierdzają właściwy build.

Świeży origin testowy otrzymał r4, istniejący lokalny r8, a istniejący publiczny HTTPS r5 po migracji. Treść każdego odpowiada canonical r4 przy tolerancji 1e-9 dla istniejącej normalizacji liczb. Kolejne odświeżenie publicznego wariantu zachowało workspace dokładnie, bez błędów konsoli. Kadry rzeczywistego Mikrusa: `output/terrace-canopy-20261020/mikrus-taras.png` i `mikrus-wiata-sauna.png`. Dowody, kopie, porównania i wynik wdrożenia: `tmp/terrace-canopy-20261020/`. Widok publiczny pozostawiono przy tarasie. Nie powtarzano testów niezmienionych wnętrz ani testu na fizycznym iPhonie.

Przed wdrożeniem zredukowano duplikaty 1714 niezmiennych plików modeli i tekstur w katalogach wydań tej aplikacji: identyczny SHA256, rozmiar, uprawnienia i właściciel były warunkiem zastąpienia osobnej kopii twardym dowiązaniem do identycznych bajtów. Każdą ścieżkę i zawartość zachowano; po operacji ponownie sprawdzono SHA256 i wspólny inode. Ledger `asset-dedup-apply.json` dokumentuje 652 760 514 bajtów połączonych kopii. Bazy, obrazy kontenerów, archiwa i kompletne wydania pozostały dostępne. Po publikacji: **486 MB wolnego / 99% zajęcia**. Main i GitHub Pages bez zmian.
