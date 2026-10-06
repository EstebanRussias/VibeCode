// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

  // Documentation OpenAPI generee depuis les `defineRouteMeta` des handlers
  // (server/api) : Swagger UI sur /_swagger, Scalar sur /_scalar, spec brute
  // sur /_openapi.json. Active aussi en build (Docker) pour tester l'API ;
  // les routes restent protegees par server/middleware/auth.ts.
  nitro: {
    experimental: { openAPI: true },
    openAPI: {
      production: 'runtime',
      meta: {
        title: 'API billetterie — Les Nuits de la Garonne',
        description:
          'Connectez-vous via POST /api/auth/login : le cookie de session est ensuite envoye automatiquement par le navigateur. Les roles autorises sont indiques sur chaque route.',
        version: '1.0.0',
      },
    },
  },
})
