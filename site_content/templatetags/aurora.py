from django import template

register = template.Library()


@register.filter
def as_input(field):
    css = "input"
    if field.errors:
        return field.as_widget(attrs={"class": css, "aria-invalid": "true"})
    return field.as_widget(attrs={"class": css})
