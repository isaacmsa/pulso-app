@AGENTS.md

## Claude Code

- **Al empezar cada fase** de `docs/roadmap.md`, lee los documentos que la fase menciona y escribe su plan en `docs/plans/AAAA-MM-DD-fase-N-<nombre>.md` con la skill `superpowers:writing-plans`. Espera la aprobación de Isaac antes de tocar código.
- **Para la app**, la skill `expo-mobile`.
- **Si una tarea toca el contrato con la API**, el cambio empieza en `pulso-api` (aditivo y desplegado a staging). Después se regenera el cliente aquí con `pnpm api:generate`. Nunca se edita a mano `src/shared/api/generated/`.
- **Las tareas que necesitan el Xiaomi** (instalar, apagar el router, tocar ajustes del fabricante) se hacen en la sesión principal con Isaac, no en subagentes. Dile qué hacer con el teléfono y qué debería ver.
- **Si el código y un documento se contradicen**, detente y pregunta cuál manda; después actualiza el documento en el mismo commit.
- **Antes de crear una cuenta o pagar algo**, confirma con Isaac (D-011). Nunca escribas credenciales por él.
- Las preferencias generales de Isaac viven en `~/.claude/`; no las repitas en este repo.
