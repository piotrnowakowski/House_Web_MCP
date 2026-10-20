# nowe mpzp — wariant 2

## Tuje i trawy — r3, 20.10.2026

Na podstawie zaznaczenia na zdjęciu użytkownika zmieniono ciągłą wschodnią rabatę przy ogrodzeniu, od garażu przez kuchnię letnią do spa (z od −7 do ok. 30 m). Dziewięć hortensji zastąpiono tujami Szmaragd, dziewięć lawend trzcinnikami; istniejące trawy przesunięto i dodano dziewięć kęp, tworząc dziewięć grup po trzy trzcinniki pomiędzy tujami. Tuja co ok. 4,2 m jest pionowym akcentem; trawy w trójkątach dają niższą, powtarzalną warstwę. Razem w tej części: **9 tui i 27 traw**, w całym projekcie **184 rośliny**, w tym 161 ozdobnych.

W modelu tuja `Thuja occidentalis 'Smaragd'` ma docelowo **4,6 m wysokości i Ø1,3 m**, z zaokrągleniem rezerwy szerokości w górę względem 15 ft × 3–4 ft podanych przez [szkółkę Monrovia](https://www.monrovia.com/emerald-green-arborvitae.html). Trzcinnik Karl Foerster zachowuje **1,8 × 0,6 m** ([RHS Plants](https://rhs.crocdn.co.uk/plants/_/calamagrostis--acutiflora-karl-foerster/classid.2000012392/)). To docelowa skala, nie wielkość sadzonek; rzeczywisty wzrost zależy od stanowiska i pielęgnacji. Dobór wymaga potwierdzenia nasłonecznienia, wilgotności i gleby. Wszystkie pozostałe nasadzenia, wyposażenie, nawierzchnie, budynki i dachy zachowano bez zmian. Bilans powierzchni r2 pozostaje aktualny.

`before-thuja-r2.json` zachowuje poprzednią publikację; `initial-r1.json` pozostaje niezmienną bazą pierwszej migracji. Stabilne identyfikatory zastępowanych roślin zachowano. Przed pracą skopiowano rzeczywiste profile Chrome/IAB i wspólne dane do `tmp/thuja-border-20261020/`. Lokalny wariant r6/baza2 oraz publiczny HTTPS r2/baza2 były zgodne z kanonicznym r2, bez konfliktów. Pozostałych projektów nie nadpisano.

Przeszło 601 testów w 112 plikach, lint, build frontendu i API oraz kontrola sekretów. Sprawdzono odstępy koron, granic i przejść oraz zachowanie lokalnego usunięcia zastępowanej rośliny z jawnym konfliktem zamiast jej odtworzenia.

Osobny projekt `project/nowe-mpzp-v2`, przygotowany 20.10.2026 na podstawie ilustracji „Ogród — koncepcja zagospodarowania” przekazanej przez użytkownika. Kanoniczna rewizja: **3**. Na [Mikrusie](https://natan203-20203.mikrus.cloud/) wybierz **Projekty → nowe mpzp — wariant 2**.

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
