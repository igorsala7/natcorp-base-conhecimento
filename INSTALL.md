# Instalacao — kit de auditoria de agentes

## 1. Copiar para o projeto

Descompacte na raiz do repositorio. Estrutura final:

```
seu-projeto/
├── .claude/
│   ├── agents/
│   │   └── agent-auditor.md
│   └── skills/
│       └── agent-audit/
│           ├── SKILL.md
│           ├── audit.config.example.yaml
│           ├── scripts/
│           │   ├── extract.py
│           │   ├── count_tokens.py
│           │   ├── tool_overlap.py
│           │   ├── trace_analysis.py
│           │   └── cache_check.py
│           └── references/
│               ├── thresholds.md
│               ├── instrumentation.md
│               ├── remediation.md
│               └── report_template.md
└── audit.config.yaml        <- voce cria (copia do .example)
```

Skill e subagente ficam versionados junto com o projeto — o time inteiro herda.

## 2. Dependencias

```bash
pip install anthropic pyyaml numpy scikit-learn 'psycopg[binary]'
```

## 3. Variaveis de ambiente

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@<host>:6543/postgres'
```

A connection string sai em **Supabase Dashboard → Project Settings → Database → Connection string (URI)**. Use o pooler (porta 6543) se estiver atras de NAT/IPv4. **Nao e a anon key** — a auditoria precisa ler tabelas internas, entao usa conexao direta.

Adicione ao `.gitignore`:

```
.audit/
audit.config.yaml
.env
```

`.audit/` guarda prompts e amostras de resposta. Nao versione.

## 4. Config

```bash
cp .claude/skills/agent-audit/audit.config.example.yaml audit.config.yaml
```

Ajuste as queries ao seu schema. Antes disso, inspecione:

```bash
psql "$SUPABASE_DB_URL" -c "\dt"
psql "$SUPABASE_DB_URL" -c "\d nome_da_tabela"
```

Se preferir, deixe o Claude Code fazer isso — a skill instrui a explorar o schema antes de assumir nomes.

## 5. Rodar

No VS Code com Claude Code, delegue ao subagente:

```
Use o agent-auditor para auditar os 4 agentes. Comece pelo maior.
```

Ou rode direto:

```bash
S=.claude/skills/agent-audit/scripts
python $S/extract.py --config audit.config.yaml
python $S/count_tokens.py --model claude-sonnet-4-6
python $S/tool_overlap.py --agent <maior-agente> --top 15
python $S/trace_analysis.py --from-supabase
```

## Pre-requisito que talvez falte

`trace_analysis.py` precisa de log **por chamada ao modelo**, nao por turno de usuario. Se voce ainda nao tem isso, e a primeira tarefa: `references/instrumentation.md` traz o schema da tabela, os indices, e o trecho de captura para Edge Function.

Sem esse log, a auditoria consegue medir o prompt mas nao consegue distinguir "prompt grande" de "loop iterando demais" — e o tratamento e completamente diferente.

## O que este kit nao faz

Mede custo e sinais de confusao. **Nao mede assertividade.** Duas tools indistinguiveis viram risco medido; a taxa real de erro so sai de um conjunto de avaliacao com consultas reais rotuladas.

Se o eval set ainda nao existe, ele e prioridade acima de qualquer otimizacao que este kit sugerir — sem baseline, nenhuma mudanca e reversivel com seguranca.
