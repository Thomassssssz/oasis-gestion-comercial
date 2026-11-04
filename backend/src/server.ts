import { createApp } from "./app.js";

// El puerto se puede cambiar con la variable de entorno PORT.
const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`API de Oasis escuchando en http://localhost:${port}`);
});
