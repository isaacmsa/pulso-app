@AGENTS.md

## Claude Code

- **El plan vigente es el tablero `docs/roadmap.md` y un archivo por fase en `docs/phases/`** (D-046); los planes de `docs/plans/` quedan como registro de las fases 0 a 4. Las fases se ejecutan sin pedir otro plan ni otra aprobación, en modo ligero (pedido de Isaac, 30 de octubre): las tareas chicas van directo con TDD, sin revisor por tarea, y hay una revisión al cerrar la fase. Solo se detiene en lo que cada fase lista en «Lo que necesita de Isaac»: pagos y cuentas, el teléfono en la mano, datos reales y publicar en Play. Las decisiones menores se toman, se anotan en `docs/decisions.md` y se le listan a Isaac al cerrar cada fase.
- **Una sesión por fase.** Lo que una sesión le deja a la siguiente va en «Siguiente paso» y «Bitácora» del archivo de la fase, no en `.superpowers/` ni en notas fuera del repo: esas no se versionan y la sesión siguiente no las ve.
- **Para la app**, la skill `expo-mobile`.
- **Si una tarea toca el contrato con la API**, el cambio empieza en `pulso-api` (aditivo y desplegado a staging). Después se regenera el cliente aquí con `pnpm api:generate`. Nunca se edita a mano `src/shared/api/generated/`.
- **Las tareas que necesitan el Xiaomi** (instalar, apagar el router, tocar ajustes del fabricante) se hacen en la sesión principal con Isaac, no en subagentes. Dile qué hacer con el teléfono y qué debería ver.
- **Si el código y un documento se contradicen**, detente y pregunta cuál manda; después actualiza el documento en el mismo commit.
- **Antes de crear una cuenta o pagar algo**, confirma con Isaac (D-011). Nunca escribas credenciales por él.
- Las preferencias generales de Isaac viven en `~/.claude/`; no las repitas en este repo.
