# Campanhas Agendadas no Kiagenda

## 1. Arquitetura

### Objetivo
- Permitir importacao manual de mini campanhas JSON.
- Trabalhar com baixo volume, previsibilidade e seguranca operacional.
- Enviar somente para tenants liberados manualmente pelo admin.
- Pausar automaticamente novos envios quando o lead responder.

### Decisao de persistencia atual
- A implementacao atual usa arquivos JSON por tenant em `data/campaigns/<tenantId>.json`.
- Isso combina com o restante do Kiagenda, que ja persiste tenants, sessoes e estados em arquivo.
- O schema SQL abaixo fica como contrato de migracao futura para SQLite ou outro banco.

### Componentes
- `backend/campaigns/campaignStore.js`
  - persiste `campaigns`, `queue`, `logs`, `leadHistory` e `inboundReplies`
- `backend/campaigns/campaignService.js`
  - valida JSON
  - importa campanha
  - bloqueia duplicidade
  - bloqueia lead com resposta recente
  - processa a fila
- `backend/campaigns/campaignWorker.js`
  - roda periodicamente
  - processa no maximo o que estiver pronto e seguro para envio
- `backend/bot/whatsappSessions.js`
  - envia pelo tenant certo via `whatsapp-web.js`
  - ao receber resposta, marca o lead como `replied` e pausa automacoes

### Controle de acesso
- O recurso nao depende do plano publico do painel.
- Cada tenant tem `features.campaigns.enabledByAdmin`.
- No painel esse recurso aparece como `Ninja Send`.
- O admin pode tambem definir:
  - `privatePlanCode`
  - `dailyLimit`
  - `maxDailyLimit`
  - `operationalWindowStart`
  - `operationalWindowEnd`
  - `timezone`
  - `replyPauseHours`

### Fluxo resumido
1. O squad local gera um JSON em `leads/Fila/`.
2. Voce sobe o arquivo manualmente no Kiagenda.
3. O importador valida e grava a campanha na fila.
4. O worker roda em polling e envia somente itens elegiveis.
5. Se houver resposta inbound, os proximos envios para aquele telefone vao para `replied`.
6. Logs e historico ficam registrados por tenant.

## 2. Schema SQL

### Observacao
- O sistema atual salva em JSON.
- Este schema e o contrato oficial para quando voce quiser migrar para SQLite/Postgres sem mudar a logica.

```sql
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  source_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'imported',
  mode TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  daily_limit INTEGER NOT NULL DEFAULT 10,
  max_daily_limit INTEGER NOT NULL DEFAULT 20,
  operational_window_start TEXT NOT NULL DEFAULT '09:15',
  operational_window_end TEXT NOT NULL DEFAULT '17:30',
  imported_by TEXT NOT NULL DEFAULT 'admin',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_campaigns_tenant_batch
  ON campaigns (tenant_id, batch_id);

CREATE TABLE dispatch_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  company TEXT NOT NULL,
  city TEXT,
  niche TEXT,
  phone TEXT NOT NULL,
  personalized_message TEXT NOT NULL,
  send_mode TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  next_eligible_at TEXT NOT NULL,
  min_delay_minutes INTEGER NOT NULL DEFAULT 0,
  max_delay_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled',
  attempts INTEGER NOT NULL DEFAULT 0,
  source_status TEXT,
  failure_reason TEXT,
  tags_json TEXT,
  metadata_json TEXT,
  duplicate_blocked INTEGER NOT NULL DEFAULT 0,
  reply_blocked INTEGER NOT NULL DEFAULT 0,
  daily_limit_day_key TEXT,
  sent_at TEXT,
  replied_at TEXT,
  cancelled_at TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
);

CREATE INDEX idx_dispatch_queue_due
  ON dispatch_queue (tenant_id, status, next_eligible_at);

CREATE INDEX idx_dispatch_queue_phone
  ON dispatch_queue (tenant_id, phone);

CREATE TABLE dispatch_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT,
  queue_id TEXT,
  level TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_dispatch_logs_campaign
  ON dispatch_logs (tenant_id, campaign_id, created_at);

CREATE TABLE lead_message_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_lead_history_phone
  ON lead_message_history (tenant_id, phone, created_at);

CREATE TABLE inbound_replies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  contact_id TEXT,
  body TEXT,
  raw_json TEXT,
  received_at TEXT NOT NULL
);

CREATE INDEX idx_inbound_replies_phone
  ON inbound_replies (tenant_id, phone, received_at);
```

## 3. Formato JSON definitivo

### Arquivo
- nome sugerido:
  - `campanha-2026-04-30-lote-01.json`
  - `campanha-2026-04-30-lote-02.json`

### Estrutura oficial

```json
{
  "campaign_name": "Promocao de Sites - Lote 01",
  "batch_id": "promo-sites-2026-04-30-lote-01",
  "daily_limit": 10,
  "timezone": "America/Sao_Paulo",
  "operational_window": {
    "start": "09:15",
    "end": "17:30"
  },
  "metadata": {
    "offer": "Promocao de Sites",
    "origin": "google-maps-squad",
    "notes": "Leads sem site com potencial local"
  },
  "items": [
    {
      "lead_id": "gmaps-osasco-001",
      "company": "Loja Exemplo",
      "city": "Osasco",
      "niche": "Loja de roupa",
      "phone": "5511999999999",
      "personalized_message": "Oi, vi a Loja Exemplo aqui de Osasco e notei que voces podem aproveitar melhor a busca local com um site simples e profissional. Estou com uma Promocao de Sites pensada justamente para negocios desse perfil. Se fizer sentido, te explico em 2 minutos sem compromisso.",
      "send_mode": "standard",
      "scheduled_for": "",
      "min_delay_minutes": 18,
      "max_delay_minutes": 34,
      "tags": ["promocao-sites", "sem-site", "google-maps"],
      "metadata": {
        "maps_query": "loja de roupa osasco",
        "qualification_reason": "sem_site",
        "score": "warm"
      },
      "status": "ready"
    }
  ]
}
```

### Regras do JSON
- `campaign_name`: nome amigavel da mini campanha.
- `batch_id`: identificador externo unico por lote.
- `daily_limit`: iniciar em `10`, podendo cair para `3` ou subir ate `20`.
- `timezone`: padrao `America/Sao_Paulo`.
- `items`: minimo `3`, recomendado `10`, maximo inicial `20`.
- `phone`: sempre em formato numerico com DDI, ex. `5511999999999`.
- `personalized_message`: obrigatoria e pronta para envio.
- `scheduled_for`: opcional. Se vazio, o Kiagenda agenda automaticamente dentro da janela.
- `min_delay_minutes` e `max_delay_minutes`: opcionais. Se ausentes, o sistema calcula.
- `status`: usar `ready` na origem.

## 4. Fluxo de importacao

### Importador
1. Ler o JSON.
2. Validar estrutura raiz.
3. Validar `batch_id` e quantidade de itens.
4. Validar telefone item a item.
5. Validar mensagem personalizada.
6. Validar duplicidade ativa na fila.
7. Validar resposta recente do lead.
8. Criar `campaign`.
9. Criar itens da `dispatch_queue`.
10. Registrar `dispatch_logs`.
11. Retornar resumo com:
  - total recebido
  - aceitos
  - bloqueados
  - motivo por item bloqueado

### Status usados
- `pending`
- `scheduled`
- `sending`
- `sent`
- `failed`
- `replied`
- `cancelled`
- `skipped`

## 5. Logica de agendamento

### Modo pequeno
- `3` leads
- distribuicao inicial:
  - envio 1: imediato ou ate 2 min
  - envio 2: entre 7 e 10 min
  - envio 3: entre 25 e 30 min

### Modo padrao
- `10` leads por dia por padrao
- distribuicao ao longo do dia dentro da janela operacional
- jitter aleatorio entre slots
- sem cadencia fixa de minutos

### Regras operacionais
- janela segura padrao:
  - inicio `09:15`
  - fim `17:30`
- limite diario inicial:
  - padrao `10`
  - minimo operacional `3`
  - teto inicial `20`
- prevencao de padrao suspeito:
  - offsets com jitter
  - proximo horario por slot, nao por intervalo rigido
  - reenvio de falha somente apos novo delay maior

## 6. Worker de envio

### Comportamento
1. Rodar por polling.
2. Buscar itens `pending` e `scheduled`.
3. Selecionar apenas o primeiro item elegivel por tenant.
4. Confirmar sessao WhatsApp pronta.
5. Confirmar que o tenant ainda tem a feature liberada.
6. Confirmar que o lead nao respondeu recentemente.
7. Confirmar que o telefone nao recebeu envio no mesmo dia.
8. Mudar para `sending`.
9. Enviar pelo `whatsapp-web.js`.
10. Atualizar para `sent` ou `failed`.
11. Registrar log.

### Pausa por resposta
- Quando entra mensagem inbound, o `whatsappSessions.js` chama `markLeadReplied`.
- Todo item ativo do mesmo telefone vai para `replied`.
- Isso impede novas automacoes para aquele lead.

## 7. Regras de seguranca operacional

### Obrigatorias
- nao repetir envio no mesmo dia para o mesmo telefone
- nao enviar para lead com resposta recente
- respeitar limite diario do tenant/campanha
- nao manter mais de uma fila ativa para o mesmo telefone
- permitir cancelamento manual da campanha
- nao enviar se a sessao WhatsApp do tenant nao estiver pronta

### Recomendadas
- nao importar mais de um lote por vez por tenant
- manter lotes de `3` a `10` no inicio
- subir para `20` somente apos validar estabilidade e resposta
- revisar manualmente cada JSON antes da importacao

## 8. Contrato com o squad local

### Pasta de saida
- `leads/Fila/`

### Convencao de nomes
- `campanha-YYYY-MM-DD-lote-01.json`
- `campanha-YYYY-MM-DD-lote-02.json`

### Regra para o squad
- cada item ja sai com a mensagem final pronta
- o squad nao define status interno de envio
- o squad deve exportar sempre com:
  - `lead_id`
  - `company`
  - `city`
  - `niche`
  - `phone`
  - `personalized_message`

### Exemplo de mensagem
- mensagem curta
- contextual
- citando cidade ou contexto local
- foco na oferta `Promocao de Sites`
- sem parecer automacao em massa

## 9. Endpoints internos sugeridos

### Ja implementados
- `GET /api/tenants/:tenantId/campaigns`
  - lista campanhas, fila, logs e replies recentes
- `POST /api/tenants/:tenantId/campaigns/import`
  - importa JSON da campanha enviado no body
- `POST /api/tenants/:tenantId/campaigns/process`
  - executa um ciclo manual do worker para o tenant
- `POST /api/tenants/:tenantId/campaigns/:campaignId/cancel`
  - cancela itens pendentes/agendados
- `PUT /api/admin/tenants/:tenantId/campaign-access`
  - libera ou bloqueia o recurso por tenant

### Recomendados para a proxima etapa
- `GET /api/tenants/:tenantId/campaigns/:campaignId`
- `POST /api/tenants/:tenantId/campaigns/:campaignId/pause`
- `POST /api/tenants/:tenantId/campaigns/:campaignId/resume`
- `POST /api/tenants/:tenantId/campaigns/validate`
- `POST /api/tenants/:tenantId/campaigns/upload-json`

## 10. Proximos passos de implementacao

1. Adicionar UI admin para upload manual do JSON e toggle de acesso da feature.
2. Exibir fila com filtros por `scheduled`, `sent`, `failed`, `replied`.
3. Adicionar download do resumo da importacao.
4. Opcionalmente migrar a persistencia para SQLite mantendo o mesmo contrato.
5. Ajustar o squad local para gerar exatamente este JSON em `leads/Fila/`.
