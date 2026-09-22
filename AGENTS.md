<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Orientação do repositório

Este bloco fica FORA do trecho autogerado acima, para sobreviver à próxima
geração. (Ressalva conhecida: o bloco acima manda `pnpm dlx` num projeto que
usa **npm** — ver o corpo do commit `cb18965`.)

Antes de mexer neste repositório, leia dois arquivos, nesta ordem:

1. **`CLAUDE.md`** — o contexto permanente. A **PARTE 0** é a que importa
   primeiro: este repositório é uma plataforma de documentação **e** um chatbot
   de IA sobre o ERP da Natcorp, e quem lê só a segunda metade toma decisão
   errada. A regra central é **assertividade acima de tudo**, e a regra de
   trabalho é **medir antes de mexer**.
2. **`docs/estado-e-proximos-passos.md`** — o que está aberto hoje e o que
   depende de decisão do dono.

Para saber **onde as coisas moram**: `docs/CODEBASE_MAP.md` (mapa do código, com
o funil de ferramentas etapa por etapa, o pipeline de RAG, o modelo de dados por
domínio e as armadilhas que mais voltaram).
