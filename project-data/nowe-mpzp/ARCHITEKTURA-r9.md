# „nowe mpzp” r9 — stodoły bez okapów

Na życzenie użytkownika dom i niższy garaż kampera z warsztatem otrzymują ciemną blachę na dachach, elewacje w drewnie naturalnym i czernionym oraz smuklejsze ramy przeszklonych szczytów domu. Krawędź stropu piętra ma kolor czarnych ścian `#303638`, więc znika szary poziomy pas. Zachowane otwory, wyposażenie i obrysy.

Porównano wszystkie **12 pomieszczeń** z aktualnym kanonicznym **architekt r10**: wewnętrzne wielokąty, szerokości, głębokości, powierzchnie, położenia i grubości ścian oraz wysokości kondygnacji są zgodne. Przeniesiono jedną późniejszą korektę architekta: ściana przy pustce salonu `wall/architekt/correction/1/living-void/1` ma **1,40 m zamiast 2,80 m**, aby zachować prawidłową bazę szczytu. Rzuty pomieszczeń nie wymagały zmian. Dane wymiarowe: [room-dimensions-r9.json](room-dimensions-r9.json). To zgodność z modelem projektu „architekt”; nie wykonano nowego porównania z zewnętrznym plikiem CAD lub dokumentacją papierową.

Usunięto nominalny wysięg okapów poza lico ścian. `overhangM` jest liczony od osi ściany, więc dla domu wynosi teraz **0,225 m**, a dla garażu **0,15 m**: dokładnie połowę grubości ściany. Zerowanie tego parametru skróciłoby dach do osi ścian. Dach domu został skrócony o 0,60 m, garażu o 0,45 m na każdej zewnętrznej krawędzi. Obróbki, grubość warstw i ukryte odwodnienie są detalami do projektu wykonawczego; nie modelowano rynien.

## Kąty z finalnej geometrii

Obliczenie symetrycznych połaci: `atan((ridge − axisEaves) / (span/2))`. Sprawdzono również poziom krawędzi przy licu: `axisEaves − tan(pitch) × halfWall`.

| Bryła | Rozpiętość między osiami ścian | Kąt obu połaci | Kalenica | Krawędź przy licu |
|---|---:|---:|---:|---:|
| Dom, front-barn | 7,30 m | **38,8097094818°** | 8,0856938754 m | 4,9690325693 m |
| Dom, rear-barn | 7,19 m | **39,2352369450°** | 8,0856938754 m | 4,9662639438 m |
| Garaż | 4,80 m | **37°** | 5,7585297202 m | 3,8369668925 m |

Wszystkie główne połacie mieszczą się w zakresie **37–45°**. Wysokości są rzędnymi modelu, a nie pomiarem nad terenem. Kalenice obu części domu mają wspólny poziom i zachowane przecięcie lokalne `(-1.19,-2.985)`; węzeł rear-min/valley jest rozpoznawany, wewnętrzny szczyt pomijany. Wymiary dachu w osi ścian, kąty, wysokości i kierunki kalenic są identyczne z r8.

## Układ i bilans

Garaż **67,32 m²**, po 1,50 m od obu granic przy pełnych ścianach, nadal równoległy do domu. Nominalny obrys krawędzi dachu pokrywa się z obrysem ścian. Wiata na dwa auta **6,60 × 6,40 m** przylega do końca domu. Brama na jej osi i jeden prosty podjazd, bez utwardzonego połączenia z garażem. Te elementy są identyczne z r8.

Ponowne obliczenie sum wielokątów: PBC **569,82 m² / 64,11%**, zabudowa **230,12 m² / 25,89%**, intensywność nadziemna do **0,395** na roboczej części MU **888,81 m²**. Metoda i nierozstrzygnięte ograniczenia opisane w [bilansie r8](BILANS-r8.md); dane r9: [balance-r9.json](balance-r9.json). Zmiana materiałów i krawędzi dachów nie zmienia powierzchni płyt ani utwardzeń.

Brak okapów przyjęto zgodnie z dyspozycją użytkownika jako założenie tego wariantu. To nie jest nowe potwierdzenie prawne dopuszczalności wszystkich rozwiązań. Projekt MPZP pozostaje projektem; hipotetyczne 1,5 m, ochrona pożarowa, odległość stanowisk wiaty od okien, przeniesiony zjazd oraz konstrukcja i odwodnienie wymagają odrębnego rozstrzygnięcia projektowego.
