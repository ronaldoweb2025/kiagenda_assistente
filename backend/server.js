require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const tenantAdminRoutes = require("./routes/tenantAdminRoutes");
const tenantRuntimeRoutes = require("./routes/tenantRuntimeRoutes");
const { passport } = require("./auth/googleAuth");
const { bootstrapPlanSettingsStore } = require("./tenancy/planSettingsStore");
const { bootstrapTenantConfigStore } = require("./tenancy/tenantConfigStore");
const { bootstrapTenantSessionStore } = require("./tenancy/tenantSessionStore");
const { bootstrapTenantStateStore } = require("./tenancy/tenantStateStore");
const { bootstrapSessions } = require("./bot/whatsappSessions");

const app = express();
const PORT = Number(process.env.PORT || 3010);
const frontendPath = path.resolve(__dirname, "../frontend");

bootstrapTenantConfigStore();
bootstrapTenantSessionStore();
bootstrapTenantStateStore();
bootstrapPlanSettingsStore();

app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "kiagenda-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(frontendPath));
app.use(authRoutes);
app.use(tenantAdminRoutes);
app.use(tenantRuntimeRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    message: error.message || "Erro interno no servidor."
  });
});

app.listen(PORT, () => {
  console.log(`Kiagenda rodando em http://localhost:${PORT}`);
  bootstrapSessions().catch((error) => {
    console.error("Nao foi possivel restaurar as sessoes do WhatsApp no startup:", error);
  });
});
