# Administración de campañas con Cloudflare D1

El panel crea y edita los registros de campañas en D1. La portada y la página universal `campana.html` leen los mismos registros. Guardar o cambiar el estado no genera ni publica HTML por campaña.

## Configuración única del servicio

1. Instala Wrangler e inicia sesión en Cloudflare.
2. Crea la base de datos:

   ```powershell
   npx wrangler d1 create huellas-campanas
   ```

3. Copia el `database_id` mostrado a `wrangler.toml`.
4. Crea las tablas en D1 (también puedes ejecutar este paso si ya creaste la tabla de campañas; no elimina sus datos):

   ```powershell
   npx wrangler d1 execute huellas-campanas --remote --file=schema.sql
   ```

5. Cambia `ALLOWED_ORIGINS` en `wrangler.toml` por el origen del sitio publicado, sin `/` final.
6. Establece la clave administrativa y despliega:

   ```powershell
   npx wrangler secret put ADMIN_TOKEN
   npx wrangler deploy
   ```

   No guardes esa clave en archivos del sitio. Escríbela en el campo de administración al conectar el panel.

7. En el archivo `api-config.js` del sitio, reemplaza la URL de ejemplo por la URL HTTPS del Worker.
8. Publica el sitio una sola vez con `index.html`, `campana.html`, `panel_campanas.html` y `api-config.js`. A partir de ahí, la gestión cotidiana se hace desde el panel y solo se editan registros de D1.

## Uso del panel

Abre el panel publicado, escribe la clave y pulsa **Conectar**. Usa **Crear campaña** para un caso nuevo o selecciona uno existente para editarlo. Guarda los cambios para que la portada y las páginas de campaña los muestren desde D1. Cambiar el estado entre vigente y completado actualiza la presentación del mismo caso.

Los métodos de pago se configuran por campaña: completa el número de cuenta para mostrar la transferencia bancaria y/o el usuario de PayPal.me para mostrar PayPal. Los métodos sin configurar no aparecen. Kira conserva su ventana de donación y la página general `donar/` es independiente.

Para la página general `/donar/`, selecciona **Editar página de donaciones** en el panel conectado. Allí puedes guardar la cuenta bancaria, la URL pública HTTPS de la imagen QR de Deuna, su enlace de pago, el enlace de PayPal y TikTok. Los métodos vacíos no aparecen. La imagen QR debe estar alojada en una URL pública accesible; el panel guarda el enlace, no sube la imagen. Si sustituyes la imagen en la misma URL, la caché puede mostrar la anterior: usa una URL distinta al actualizarla.

## API

- `GET /api/donation-settings`: datos públicos de la página general de donaciones.
- `PUT /api/admin/donation-settings`: guardar los datos generales, protegido por `ADMIN_TOKEN`.
- `GET /api/campaigns`: todos los casos, vigentes y completados, para la portada.
- `GET /api/campaigns/:slug`: un caso por su nombre de enlace.
- `GET /api/admin/campaigns`: lista administrativa, protegida por `ADMIN_TOKEN`.
- `POST /api/admin/campaigns`: crear un caso.
- `PUT /api/admin/campaigns/:id`: actualizar un caso.
- `DELETE /api/admin/campaigns/:id`: eliminar un caso.

Todas las escrituras requieren el secreto de administración.
