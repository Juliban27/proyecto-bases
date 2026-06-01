# Smart Parking DB

Sistema de gestión de parqueadero desarrollado como proyecto académico para la materia de **Bases de Datos**.  
Demuestra el uso de **Triggers SQL**, **Vistas SQL** y el patrón **Decorador** aplicado a un backend REST.

---

## Tabla de contenidos

- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Modelo de datos](#modelo-de-datos)
- [Triggers SQL](#triggers-sql)
- [Vistas SQL](#vistas-sql)
- [Decoradores (Django Signals)](#decoradores-django-signals)
- [Requisitos previos](#requisitos-previos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Datos de prueba](#datos-de-prueba)
- [Endpoints de la API](#endpoints-de-la-api)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Funcionalidades](#funcionalidades)

---

## Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Python | 3.14.5 |
| Framework web | Django | 6.0.5 |
| API REST | Django REST Framework | 3.17.1 |
| CORS | django-cors-headers | 4.9.0 |
| Base de datos | SQLite | (incluida con Python) |
| Frontend | React | 19 |
| Build tool | Vite | 8 |
| HTTP client | Axios | 1.16 |
| Runtime JS | Node.js | 24.15 |

---

## Arquitectura

```
proyecto-bases/
├── backend_app/        ← Proyecto Django
│   ├── api/            ← App principal con modelos, vistas, serializers
│   │   ├── migrations/ ← Migraciones SQL (incluye triggers y vistas)
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── signals.py  ← Decoradores (patrón Observer/Signal)
│   │   └── urls.py
│   ├── backend_app/    ← Configuración Django
│   └── db.sqlite3      ← Base de datos
├── frontend/           ← App React + Vite
│   └── src/
│       ├── components/
│       └── api.js
└── venv/               ← Entorno virtual Python
```

**Flujo de una operación completa:**

```
Usuario → React → Axios → Django REST → SQLite
                                     ↓
                              Trigger SQL actúa
                                     ↓
                           Signal Django actúa
                                     ↓
                          Respuesta → React actualiza UI
```

---

## Modelo de datos

```
Cliente ──< Vehiculo ──< Ticket >── Espacio
                            │
                            ├──> Tarifa
                            ├──> Empleado
                            └──< Pago
```

### Entidades

| Modelo | Descripción | PK |
|--------|------------|-----|
| `Cliente` | Propietario del vehículo | `id_cliente` (AutoField) |
| `Vehiculo` | Vehículo del cliente | `placa` (CharField) |
| `Empleado` | Cajero o vigilante que registra | `id_empleado` (AutoField) |
| `Espacio` | Lugar físico en el parqueadero | `id_espacio` (AutoField) |
| `Tarifa` | Precio por unidad de tiempo | `id_tarifa` (AutoField) |
| `Ticket` | Registro de estadía de un vehículo | `id_ticket` (AutoField) |
| `Pago` | Pago asociado 1:1 a un Ticket | `id_pago` (AutoField) |

---

## Triggers SQL

Los triggers están definidos en la migración `api/migrations/0003_triggers_y_vistas.py` y se ejecutan directamente en SQLite.

### `trg_ocupar_espacio`
```sql
CREATE TRIGGER trg_ocupar_espacio
AFTER INSERT ON api_ticket
FOR EACH ROW
WHEN NEW.id_espacio_id IS NOT NULL
BEGIN
    UPDATE api_espacio
    SET estado = 'Ocupado'
    WHERE id_espacio = NEW.id_espacio_id;
END;
```
**Propósito:** Al crear un ticket, marca automáticamente el espacio como `Ocupado`.

---

### `trg_liberar_espacio_al_pagar`
```sql
CREATE TRIGGER trg_liberar_espacio_al_pagar
AFTER INSERT ON api_pago
FOR EACH ROW
BEGIN
    UPDATE api_espacio
    SET estado = 'Libre'
    WHERE id_espacio = (
        SELECT id_espacio_id FROM api_ticket WHERE id_ticket = NEW.id_ticket_id
    );

    UPDATE api_ticket
    SET estado = 'Pagado',
        fecha_salida = DATETIME('now')
    WHERE id_ticket = NEW.id_ticket_id
      AND fecha_salida IS NULL;
END;
```
**Propósito:** Al registrar el pago, libera el espacio y cierra el ticket con la fecha de salida real.

---

### `trg_validar_espacio_libre`
```sql
CREATE TRIGGER trg_validar_espacio_libre
BEFORE INSERT ON api_ticket
FOR EACH ROW
WHEN NEW.id_espacio_id IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'El espacio ya está ocupado')
    WHERE (
        SELECT estado FROM api_espacio WHERE id_espacio = NEW.id_espacio_id
    ) = 'Ocupado';
END;
```
**Propósito:** Integridad a nivel de BD — impide insertar un ticket en un espacio ya ocupado, incluso si se hace directamente sobre la BD sin pasar por la aplicación.

---

## Vistas SQL

Definidas en la misma migración `0003`. Simplifican las consultas de reportes.

### `vista_ocupacion_actual`
Join completo entre `api_espacio`, `api_ticket` (solo activos), `api_vehiculo`, `api_cliente` y `api_tarifa`. Muestra el estado en tiempo real del parqueadero.

### `vista_ingresos_diarios`
Agrupa los pagos por fecha y calcula total de pagos, suma de ingresos y promedio por pago para cada día.

### `vista_tickets_completos`
Historial completo con todos los JOINs. Incluye columna `minutos_estadia` calculada en SQL con `JULIANDAY`.

### `vista_uso_espacios`
Ranking de espacios por número de usos, total generado y promedio de minutos de estadía.

---

## Decoradores (Django Signals)

El archivo `api/signals.py` implementa el patrón **Decorador / Observer** de Django para reaccionar a eventos del ORM:

```python
@receiver(post_save, sender=Ticket)
def actualizar_estado_espacio_ticket(sender, instance, created, **kwargs):
    # Complementa el trigger SQL — actúa a nivel de aplicación
    if created and instance.id_espacio:
        espacio = instance.id_espacio
        espacio.estado = 'Ocupado'
        espacio.save()

@receiver(post_save, sender=Pago)
def liberar_espacio_por_pago(sender, instance, created, **kwargs):
    # Cierra el ticket y libera el espacio cuando se registra un pago
    if created:
        ticket = instance.id_ticket
        ticket.estado = 'Pagado'
        ticket.fecha_salida = timezone.now()
        ticket.save()
```

> **Nota académica:** Los triggers SQL actúan a nivel de base de datos (cualquier cliente que escriba en la BD los dispara). Los signals de Django actúan a nivel de aplicación (solo cuando se usa el ORM). Ambos coexisten para garantizar integridad en dos capas.

---

## Requisitos previos

- Python **3.10+**
- Node.js **18+**
- Git

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd proyecto-bases
```

### 2. Configurar el backend

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Aplicar migraciones (crea tablas, triggers y vistas)
python backend_app/manage.py migrate

# Cargar datos de prueba
python backend_app/manage.py loaddata datos_iniciales.json

# Iniciar servidor backend
python backend_app/manage.py runserver
```

El backend queda disponible en: `http://localhost:8000`

### 3. Configurar el frontend

```bash
# En otra terminal
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend queda disponible en: `http://localhost:5173`

### 4. Verificar que todo funciona

Abre `http://localhost:5173` en el navegador. Deberías ver el mapa del parqueadero con los 12 espacios disponibles.

---

## Datos de prueba

El sistema incluye datos iniciales listos para demo:

| Categoría | Datos |
|-----------|-------|
| **Espacios** | A1–A4 (Cubierto), B1–B4 (Descubierto), C1–C2 (VIP), M1–M2 (Motos) |
| **Tarifas** | Automóvil $120/min, Moto $60/min, Día carro $50.000, Día moto $25.000 |
| **Empleados** | Carlos Ramírez (Cajero), Laura Gómez (Supervisor), Pedro Torres (Vigilante) |
| **Clientes** | Ana Martínez (Regular), Juan Pérez (VIP) |
| **Vehículos** | ABC123 Toyota Blanco (Ana), XYZ789 Mazda Gris (Juan) |

Para recrear los datos manualmente:

```bash
python backend_app/manage.py shell
```

```python
from api.models import Espacio, Tarifa, Empleado, Cliente, Vehiculo

# Espacios
for cod, tipo in [('A1','Cubierto'),('A2','Cubierto'),('A3','Cubierto'),('A4','Cubierto'),
                  ('B1','Descubierto'),('B2','Descubierto'),('B3','Descubierto'),('B4','Descubierto'),
                  ('C1','VIP'),('C2','VIP'),('M1','Motos'),('M2','Motos')]:
    Espacio.objects.get_or_create(codigo=cod, defaults={'tipo_ubicacion': tipo})

# Tarifas
Tarifa.objects.get_or_create(nombre='Automóvil / Camioneta', defaults={'valor': 120, 'unidad_tiempo': 'minuto'})
Tarifa.objects.get_or_create(nombre='Motocicleta',           defaults={'valor': 60,  'unidad_tiempo': 'minuto'})
Tarifa.objects.get_or_create(nombre='Día completo - Carro',  defaults={'valor': 50000, 'unidad_tiempo': 'dia'})
Tarifa.objects.get_or_create(nombre='Día completo - Moto',   defaults={'valor': 25000, 'unidad_tiempo': 'dia'})

# Empleados
Empleado.objects.get_or_create(nombre='Carlos Ramírez', defaults={'rol': 'Cajero'})
Empleado.objects.get_or_create(nombre='Laura Gómez',    defaults={'rol': 'Supervisor'})
Empleado.objects.get_or_create(nombre='Pedro Torres',   defaults={'rol': 'Vigilante'})
```

---

## Endpoints de la API

Base URL: `http://localhost:8000/api/`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/clientes/` | Listar clientes |
| POST | `/clientes/` | Crear cliente |
| GET | `/clientes/{id}/vehiculos/` | Vehículos de un cliente |
| GET/POST | `/vehiculos/` | CRUD vehículos |
| GET/POST | `/empleados/` | CRUD empleados |
| GET | `/espacios/` | Todos los espacios |
| GET | `/espacios/libres/` | Solo espacios disponibles |
| GET | `/espacios/resumen/` | Estadísticas de ocupación |
| GET/POST | `/tarifas/` | CRUD tarifas |
| GET | `/tickets/` | Todos los tickets |
| POST | `/tickets/` | Crear ticket (registrar entrada) |
| GET | `/tickets/activos/` | Tickets en curso |
| POST | `/tickets/{id}/registrar_salida/` | Cobrar y cerrar ticket |
| GET | `/pagos/` | Historial de pagos |
| GET | `/reportes/` | Datos de reportes y estadísticas |

### Ejemplo: Registrar entrada

```bash
POST /api/tickets/
Content-Type: application/json

{
  "placa": "ABC123",
  "id_espacio": 1,
  "id_tarifa": 1,
  "id_empleado": 1
}
```

### Ejemplo: Registrar salida y cobro

```bash
POST /api/tickets/1/registrar_salida/
Content-Type: application/json

{
  "metodo_pago": "Efectivo"
}
```

**Respuesta:**
```json
{
  "total": 3600,
  "duracion_horas": 0.5,
  "pago": { "id_pago": 1, "metodo_pago": "Efectivo", "total": "3600.00" },
  "ticket": { "id_ticket": 1, "estado": "Pagado", "fecha_salida": "..." }
}
```

---

## Estructura del proyecto

```
proyecto-bases/
│
├── README.md
├── requirements.txt
│
├── backend_app/
│   ├── manage.py
│   ├── db.sqlite3
│   │
│   ├── backend_app/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   └── api/
│       ├── models.py          ← 7 modelos: Cliente, Vehiculo, Empleado,
│       │                         Espacio, Tarifa, Ticket, Pago
│       ├── serializers.py     ← Serializers con datos anidados
│       ├── views.py           ← ViewSets + endpoint /reportes/
│       ├── signals.py         ← Decoradores (post_save signals)
│       ├── urls.py            ← Router DRF + URL de reportes
│       ├── admin.py
│       └── migrations/
│           ├── 0001_initial.py
│           ├── 0002_alter_cliente_telefono.py
│           └── 0003_triggers_y_vistas.py  ← Triggers y vistas SQL
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx            ← Navegación por tabs
        ├── index.css          ← Estilos globales (dark theme)
        ├── api.js             ← Cliente Axios centralizado
        └── components/
            ├── Dashboard.jsx  ← Estadísticas + mapa
            ├── ParkingMap.jsx ← Mapa interactivo del parqueadero
            ├── Entrada.jsx    ← Formulario de ingreso
            ├── Activos.jsx    ← Tickets en curso + cobro
            ├── Historial.jsx  ← Pagos realizados con búsqueda
            ├── Reportes.jsx   ← Gráficas y estadísticas
            ├── Clientes.jsx   ← CRUD clientes y vehículos
            └── Config.jsx     ← CRUD espacios, tarifas, empleados
```

---

## Funcionalidades

### Mapa interactivo
- Visualización del parqueadero dividido por secciones (A, B, C, Motos)
- Espacios verdes (libres) y rojos (ocupados) en tiempo real
- Clic en espacio libre → formulario de entrada directo
- Clic en espacio ocupado → resumen del ticket + cobro
- Auto-refresh cada 15 segundos

### Registro de entrada
- Selección de cliente existente o creación en línea
- Selección de vehículo o creación en línea
- **Auto-sugerencia de tarifa** según tipo de vehículo (moto/carro)
- Validación: no se puede asignar un espacio ocupado

### Registro de salida y cobro
- Cálculo automático del tiempo transcurrido
- Total calculado por minuto (tarifas colombianas reales)
- Selección de método de pago (Efectivo, Tarjeta, Nequi, etc.)
- Al confirmar: trigger SQL libera el espacio automáticamente

### Historial
- Tabla completa de pagos con búsqueda por placa, cliente o método
- Duración de cada estadía
- Total de ingresos filtrados en tiempo real

### Reportes
- KPIs generales (tickets, ingresos, clientes, vehículos)
- Ingresos por día (últimos 14 días) con barras
- Métodos de pago más usados
- Vehículos más frecuentes con total pagado
- Espacios más usados con promedio de estadía

### Gestión
- CRUD completo de Clientes con vehículos expandibles
- CRUD de Espacios, Tarifas y Empleados
