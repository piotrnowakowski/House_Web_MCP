# Drzewa z oryginalnej mapy — kontrola wariantu nowe mpzp r10

**Wniosek:** nie wszystkie drzewa poza aktualnymi obrysami były uwzględnione. Przywrócono **503A**, liściaste, w oryginalnej pozycji CAD, około **2,14 m od domu**. To kandydat do zachowania warunkowo, nie potwierdzona możliwość ochrony korzeni podczas budowy. Pozostałych pozycji drzew, budynków i podjazdu nie zmieniono.

## Źródło i rejestracja

Oryginalna mapa do celów projektowych `Zielonki_dz54_55_58-akt-v2.pdf`, skala 1:500, opracowana 12.03.2026 i zweryfikowana 01.07.2026. Pobrana ponownie 20.10.2026 z [maila geodety z 03.07.2026](https://mail.google.com/mail/#all/19f27717889d2f98); tę samą mapę właściciel [przekazał architektowi 18.08.2026](https://mail.google.com/mail/#all/1a011cb195c5e7ff). SHA-256: `2F3E37E8EF694014184C32D173A8CEF4B5385FB7F249BFF2B1C22642FCF6A204`, zgodny z zachowaną mapą źródłową.

Sprawdzono wszystkie **17 symboli przy działkach /3**: 11 iglastych, 3 liściaste i 3 owocowe. Zachowane pozycje INSERT z DXF są zgodne z wykazem `knowledge-bank/zielonki/trees.ts`. Nałożenie 17 punktów na nowo pobrany PDF potwierdza centra symboli: krzyż siatki E=7421600/N=5556050, PDF (844,8;831,0), 283,38 punktu na 50 m. Wspólny sztywny transform PL-2000/model pozostał bez zmiany. Drzew nie przesuwano razem z budynkami ani nie dopasowywano do nowego MPZP.

Dwa owocowe symbole, 50C3 i 50CA, znajdują się poza własnymi działkami i są kontekstem sąsiednim. Odległe drzewa przy ulicy oraz symbol owocowego drzewa w legendzie nie należą do tego wykazu. Sprawdzono także wszystkie 34 bloki symboli drzew w całym DXF względem wszystkich sześciu własnych działek, łącznie z rolnymi /4: wewnątrz jest 15 drzew, wszystkie w omówionym wykazie przy działkach /3. Nie znaleziono dodatkowych pominiętych drzew na rolnej części projektu. Dowód: tmp/nowe-mpzp-trees-20261020/full-parcel-check.json.

## Wynik porównania

Przed kontrolą model miał 10 drzew (8 własnych + 2 sąsiednie). Po korekcie ma **11 (9 własnych + 2 sąsiednie)**. Sześć pominiętych punktów pni leży w aktualnym obrysie domu; nie przywrócono ich jako bezkolizyjnych i nie jest to decyzja o wycince.

| Oznaczenie | Kategoria mapy | Stan r10 | Najmniejsza odległość punktu pnia od budynku |
|---|---|---|---:|
| 5012 | iglaste | zachowane, blisko domu | 0,62 m |
| 5015 | iglaste | poza modelem, w obrysie domu | 0,12 m wewnątrz |
| 5018 | iglaste | zachowane, blisko domu | 0,70 m |
| 501B | iglaste | poza modelem, w obrysie domu | 1,00 m wewnątrz |
| 501E | iglaste | poza modelem, w obrysie domu | 3,30 m wewnątrz |
| 5021 | iglaste | poza modelem, w obrysie domu | 2,29 m wewnątrz |
| 5024 | iglaste | poza modelem, w obrysie domu | 0,70 m wewnątrz |
| 5027 | iglaste | zachowane, punkt poza obrysami | 3,03 m |
| 502A | iglaste | zachowane, punkt poza obrysami | 4,91 m |
| 502D | iglaste | zachowane, punkt poza obrysami | 6,92 m |
| 5030 | iglaste | zachowane, punkt poza obrysami | 6,00 m |
| 5033 | liściaste | zachowane, punkt poza obrysami | 7,98 m |
| **503A** | **liściaste** | **przywrócone warunkowo** | **2,14 m** |
| 50F5 | liściaste | poza modelem, w obrysie domu | 1,96 m wewnątrz |
| 50C3 | owocowe | sąsiad, kontekst | 6,27 m |
| 50CA | owocowe | sąsiad, kontekst | 5,22 m |
| 50D1 | owocowe | zachowane, blisko garażu | 1,40 m |

Odległości są od punktu INSERT/pnia do najbliższej krawędzi sumy obrysów płyt budynków, a nie od kory lub korony. Osobno sprawdzono utwardzenia; 503A jest około 9,20 m od najbliższego z nich. Wszystkie zachowane punkty pni są poza obrysami budynków i utwardzeń. Obliczenia w [trees-r10.json](trees-r10.json). Wyróżnienie odległości poniżej 3 m służy tylko czytelności audytu — nie jest granicą ochrony korzeni ani normą prawną.

## Granice wniosku

Mapa nie podaje średnic pni, rzeczywistych koron, korzeni ani kondycji. Modelowe 15 m wysokości i średnice koron są przybliżeniami, nie inwentaryzacją dendrologiczną. Zachowanie 503A oraz szczególnie bliskich 5012, 5018 i 50D1 wymaga oceny terenowej względem fundamentów, wykopów, instalacji, koron i organizacji budowy. 5015 leży tylko około 12 cm wewnątrz obrysu — rozstrzygnięcie na gruncie wymaga dokładnego pomiaru, a nie interpretacji tej liczby jako geodezyjnej pewności.

Audyt nie potwierdza, że wszystkie drzewa pokazane na mapie nadal fizycznie istnieją. Nie wydano zgody na usunięcie żadnego drzewa. Nie zmieniono zabudowy ani utwardzeń, więc dotychczasowy bilans PBC 64,11% pozostaje niezmieniony.
