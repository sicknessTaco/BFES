# BlackForge Entertainment Software

## Estructura
- frontend: HTML + Tailwind + JS de tienda y membresia.
- backend: API con Stripe para checkout y descargas firmadas.

## Setup rapido
1. En `backend`, copia `.env.example` a `.env` y configura tus claves Stripe.
2. Instala dependencias en `backend`.
3. Ejecuta `npm run start` en `backend`.
4. Abre `http://localhost:4000`.

## Stripe
- Reemplaza los `stripePriceId` en `backend/src/services/catalog.js` por IDs reales `price_...` si ya tienes precios creados.
- Si no pones IDs reales, el backend crea precios dinamicos para pruebas.

## Descargas
- Los archivos demo estan en `backend/files/*.zip`.
- Tras pago exitoso, `success.html` consulta `/api/checkout/confirm` y obtiene links firmados.
"# BFES" 
