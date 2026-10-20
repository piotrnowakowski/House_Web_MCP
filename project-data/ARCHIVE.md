# Porządkowanie projektów — 20.10.2026

Na polecenie użytkownika „Usuń niepotrzebne projekty poza Arhitekt mpzp 1 i 2” aktywna lista zachowuje:

- `project/architekt` — architekt, canonical r10;
- `project/nowe-mpzp` — nowe mpzp, canonical r19;
- `project/nowe-mpzp-v2` — nowe mpzp — wariant 2, canonical r2.

Pięć wcześniejszych projektów wraz z zapisanymi wersjami wycofano z lokalnego launchera i listy projektów wspólnych. Ich tożsamości zapisuje [archived-projects.json](archived-projects.json). Nowe przeglądarki otrzymują tylko trzy zachowane projekty. Przycisk odtwarzający stary dom w Zielonkach usunięto; tworzenie nowych działek nadal działa.

Usunięcie z listy jest odwracalne: nie kasuje danych projektów, historii, propozycji ani odzyskiwania. Surowe rekordy IndexedDB pozostają nietknięte podczas wyświetlania listy, a serwer zachowuje workspace i historię. Odczyt konkretnego ref nadal służy odzyskiwaniu. Przywrócenie wymaga usunięcia odpowiedniej pozycji z rejestru i ponownego włączenia jej publikacji w launcherze; pliki źródłowe są zachowane w Git.

Przed zmianą wykonano kopie rzeczywistych Chrome Default oraz Codex IAB, wszystkich pięciu wspólnych workspace i listy serwera: ignorowany katalog `tmp/project-cleanup-20261020/`. Zachowane trzy wspólne modele są zgodne z canonical poza metadanymi rewizji/czasu Architekta. Porównania według ref i baz (`retained-project-comparison.json`) potwierdziły czyste scalenia publicznych originów. Stary lokalny konflikt bramy/caveats pierwszego MPZP pozostał zachowany; nie rozstrzygano go przy porządkowaniu listy.

Nie zmieniono żadnego canonical `project.json`, wymiarów ani geometrii. Przeszło 600 testów, lint, build frontendu/API i kontrola sekretów. Testy obejmują świeży start, ponowne otwarcie listy, zachowanie trzech modeli, dokładne zachowanie surowych rekordów wycofanych projektów oraz filtrowanie listy serwera bez utraty odzyskiwania. Wdrożenie dotyczy wyłącznie gałęzi domu na Mikrusie; `main` i GitHub Pages pozostają bez zmian.
