@AGENTS.md

## Claude Code

- **Todas las fases que faltan siguen un solo plan maestro**, `docs/plans/2026-10-23-app-v1-completa.md`, que Isaac aprueba una sola vez. Con el plan aprobado, las fases se ejecutan seguidas, sin pedir otro plan ni otra aprobación. Solo se detiene en los cortes que lista el plan: pagos y cuentas, el teléfono en la mano, datos reales y publicar en Play. Las decisiones menores se toman, se anotan en `docs/decisions.md` y se le listan a Isaac al cerrar cada fase.
- **Para la app**, la skill `expo-mobile`.
- **Si una tarea toca el contrato con la API**, el cambio empieza en `pulso-api` (aditivo y desplegado a staging). Después se regenera el cliente aquí con `pnpm api:generate`. Nunca se edita a mano `src/shared/api/generated/`.
- **Las tareas que necesitan el Xiaomi** (instalar, apagar el router, tocar ajustes del fabricante) se hacen en la sesión principal con Isaac, no en subagentes. Dile qué hacer con el teléfono y qué debería ver.
- **Si el código y un documento se contradicen**, detente y pregunta cuál manda; después actualiza el documento en el mismo commit.
- **Antes de crear una cuenta o pagar algo**, confirma con Isaac (D-011). Nunca escribas credenciales por él.
- Las preferencias generales de Isaac viven en `~/.claude/`; no las repitas en este repo.
