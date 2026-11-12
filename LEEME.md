# Actualizar Valkron (de v18 a v21)

Solo cambian **dos archivos**. El resto del repositorio (vendor/, fonts/, voz/, iconos, manifest) queda igual.

1. En GitHub, repositorio `VALKRON_SWH` → **Add file → Upload files**.
2. Sube **`index.html`** y **`sw.js`** de este paquete (reemplazan a los actuales) y haz *Commit*.
   Importante: los dos a la vez, de la misma versión (v21).
3. Espera 1–2 minutos a que GitHub Pages publique.
4. En el teléfono, **con señal**: abre Valkron, espera unos segundos, ciérrala del todo (deslizar fuera de recientes) y vuelve a abrirla. Debe verse **Valkron v21** al final de la pantalla.
5. Config → «Diagnóstico de modo sin conexión» → debe marcar todo con ✔ (service worker activo, copia guardada de la v21).
6. Prueba real: activa **modo avión**, cierra la app y ábrela otra vez. Debe abrir con tus actividades y guardar lo que marques.

## Cambios en tu Google Sheet (hoja «Actividades»)
Tu Sheet manda sobre la app. Para el cronómetro hablado, edita estas filas (columna `unidad`) y ajusta la hora/orden:

| id | nombre sugerido | unidad | hora_objetivo | orden |
|---|---|---|---|---|
| v_deadhang | Dead hang (colgado de la barra) | `s · meta 60 · tope 120` | 05:10 | 3 |
| v_flexiones | Flexiones (1 serie al fallo) | `rep` | 05:12 | 4 |
| v_wallsit | Wall sit a 90° | `s · meta 90 · tope 120` | 05:15 | 5 |
| v_dominadas | Dominadas (1 serie al fallo) | `rep` | 05:17 | 6 |
| v_pantorrillas | 🦵 Pantorrillas flexionadas | `veces · meta 4` | (la que tengas) | — |

Además, para que «No olvidar» avise de los ejercicios de la mañana, pon `Sí` en la columna `critica` de las cuatro primeras.
También se incluye `semilla_Actividades.csv` con todas las actividades ya ajustadas, por si algún día quieres rehacer la hoja.

El Apps Script **no cambia**: sigue valiendo el que ya tienes.
