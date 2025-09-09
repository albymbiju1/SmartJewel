from marshmallow import Schema, fields, validate

class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        load_only=True,
        validate=validate.Length(min=6, max=128)
    )

class RegistrationSchema(Schema):
    email = fields.Email(required=True)
    name = fields.String(required=True, validate=validate.Length(min=3, max=80))
    # Password: 6-128, includes lowercase, uppercase, number
    password = fields.String(
        required=True,
        load_only=True,
        validate=[
            validate.Length(min=6, max=128),
            validate.Regexp(
                r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$",
                error="Password must contain uppercase, lowercase, and number"
            ),
        ],
    )
    phone = fields.String(required=True, validate=validate.Regexp(r"^\d{10}$"))

class StaffCreateSchema(Schema):
    email = fields.Email(required=True)
    name = fields.String(required=True, validate=validate.Length(min=3, max=80))
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8, max=128))
    level = fields.String(required=True, validate=validate.OneOf(["staff_l1","staff_l2","staff_l3"]))
    branch_id = fields.String(required=True)