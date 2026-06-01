from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClienteViewSet, VehiculoViewSet, EmpleadoViewSet,
    EspacioViewSet, TarifaViewSet, TicketViewSet, PagoViewSet,
    reportes,
)

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'vehiculos', VehiculoViewSet)
router.register(r'empleados', EmpleadoViewSet)
router.register(r'espacios', EspacioViewSet)
router.register(r'tarifas', TarifaViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'pagos', PagoViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('reportes/', reportes),
]
