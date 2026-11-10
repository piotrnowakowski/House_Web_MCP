# Aktualna lista — 10.11.2026

Na polecenie użytkownika aktywny pozostaje jeden projekt **architekt 7.11** (project/architekt-7-11). W edytorze wnętrza przycisk **Schody** udostępnia trzy układy i osobny przełącznik szafki: sześć kombinacji w tym samym domu.

Wycofane z aktywnej listy: architekt, architekt 7.11 wersja 2, architekt 7.11 schody 12+6, nowe mpzp oraz nowe mpzp — wariant 2. Ich pełne projekty i historie pozostają zachowane w Git, bazie serwera i lokalnych zapisach. Nie usuwa się ich danych. Starsze architekt/MPZP miały też inne dachy i wysokość piętra; te geometrie pozostają w archiwum. Obecny dom i wspólny ogród nie są nimi nadpisywane.

Kopie i porównania rzeczywistych profili: tmp/unified-stairs-20261110/. Szczegóły: [architekt 7.11](architekt-7-11/README.md). Poniżej historia wcześniejszego porządkowania.

# Porządkowanie projektów — 20.10.2026

Na polecenie użytkownika „Usuń niepotrzebne projekty poza Arhitekt mpzp 1 i 2” aktywna lista zachowuje:

- `project/architekt` — architekt, canonical r10;
- `project/nowe-mpzp` — nowe mpzp, canonical r19;
- `project/nowe-mpzp-v2` — nowe mpzp — wariant 2, canonical r2.

Pięć wcześniejszych projektów wraz z zapisanymi wersjami wycofano z lokalnego launchera i listy projektów wspólnych. Ich tożsamości zapisuje [archived-projects.json](archived-projects.json). Nowe przeglądarki otrzymują tylko trzy zachowane projekty. Przycisk odtwarzający stary dom w Zielonkach usunięto; tworzenie nowych działek nadal działa.

Usunięcie z listy jest odwracalne: nie kasuje danych projektów, historii, propozycji ani odzyskiwania. Surowe rekordy IndexedDB pozostają nietknięte podczas wyświetlania listy, a serwer zachowuje workspace i historię. Odczyt konkretnego ref nadal służy odzyskiwaniu. Przywrócenie wymaga usunięcia odpowiedniej pozycji z rejestru i ponownego włączenia jej publikacji w launcherze; pliki źródłowe są zachowane w Git.

Przed zmianą wykonano kopie rzeczywistych Chrome Default oraz Codex IAB, wszystkich pięciu wspólnych workspace i listy serwera: ignorowany katalog `tmp/project-cleanup-20261020/`. Zachowane trzy wspólne modele są zgodne z canonical poza metadanymi rewizji/czasu Architekta. Porównania według ref i baz (`retained-project-comparison.json`) potwierdziły czyste scalenia publicznych originów. Stary lokalny konflikt bramy/caveats pierwszego MPZP pozostał zachowany; nie rozstrzygano go przy porządkowaniu listy.

Nie zmieniono żadnego canonical `project.json`, wymiarów ani geometrii. Przeszło 600 testów, lint, build frontendu/API i kontrola sekretów. Testy obejmują świeży start, ponowne otwarcie listy, zachowanie trzech modeli, dokładne zachowanie surowych rekordów wycofanych projektów oraz filtrowanie listy serwera bez utraty odzyskiwania. Wdrożenie dotyczy wyłącznie gałęzi domu na Mikrusie; `main` i GitHub Pages pozostają bez zmian.

## Potwierdzona publikacja

Kod `f5dd922cefe814216c6ef7320ca1df44e9e92c60` opublikowano na Mikrusie 20.10.2026. Publiczne health/API są poprawne, a SHA256 pliku JS odpowiada buildowi lokalnemu. Świeży podgląd na nowym originie 127.0.0.1:5195 oraz rzeczywisty zapisany profil HTTPS pokazują dokładnie trzy projekty, także po ponownym wczytaniu i rozwinięciu historii. Konsola bez błędów. Wszystkie pięć wspólnych workspace jest dokładnie zgodnych z kopią sprzed zmiany; wszystkie 41 publicznych lokalnych workspace pozostały identyczne. Dowody: `release-verification.json`, `shared-list-after.json`, `browser-after.json` w katalogu kopii oraz `output/project-cleanup-20261020/mikrus-three-projects.png`.

Po wdrożeniu usunięto dwa nieużywane rekordy cache źródeł ostatnich dwóch wydań, uprzednio porównane z zachowanymi plikami index/nginx. Zwolniono ok. 169 MB; nie usuwano obrazów, baz, wydań ani kopii. Pozostało 304 MB dostępnego miejsca, więc dalsze większe publikacje wymagają osobnego uporządkowania pojemności. Nie wykonywano ponownego audytu geometrii i wnętrz — projektów nie zmieniano.


Published and verified: code **927a7e8673c949c8fdce821edf583c8d8e19578e**, canonical 7.11 **r12**, shared **v12**. HTTP/HTTPS health and API passed; 14 live frontend files match exact local bytes. Public connected browser shows one project and the preferred 9+9/cabinet selection. All 18 local and 18 live combinations (fresh, captured-existing and mobile; three layouts x cabinet on/off) passed save/reload, undo/redo and archive-preservation checks with no page errors. Interaction tests used isolated local browser storage and blocked shared writes; separate live API readbacks verified canonical publication and exact preservation of all five archived shared workspaces. Unit suite: 712 passed; after the final partial-cabinet restore guard, all 25 affected tests passed, including its new regression. Frontend/API builds, TypeScript and secret scan passed.

A complete 3752974-byte off-host database backup was verified, SHA256 b3fff6aa2aef1e10ee72f10dc9bab6f10cf42b38bb3305c8004847fc00b5b2bc. Rollback: /root/house-web-mcp/furnished-zielonki/deploy/mikrus/compose.yaml.before-20261110T122743Z. Recovery snapshots and evidence: tmp/unified-stairs-20261110/; screenshots: output/unified-stairs-20261110/. Main/Pages are unchanged.
