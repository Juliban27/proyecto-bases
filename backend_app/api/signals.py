from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Ticket, Pago, Espacio
from django.utils import timezone

@receiver(post_save, sender=Ticket)
def actualizar_estado_espacio_ticket(sender, instance, created, **kwargs):
    if created and instance.id_espacio:
        espacio = instance.id_espacio
        espacio.estado = 'Ocupado'
        espacio.save()

@receiver(post_save, sender=Pago)
def liberar_espacio_por_pago(sender, instance, created, **kwargs):
    if created:
        ticket = instance.id_ticket
        if ticket.id_espacio:
            espacio = ticket.id_espacio
            espacio.estado = 'Libre'
            espacio.save()
        
        # Opcionalmente, marcar el ticket como pagado/cerrado y fecha de salida
        ticket.estado = 'Pagado'
        if not ticket.fecha_salida:
            ticket.fecha_salida = timezone.now()
        ticket.save()
