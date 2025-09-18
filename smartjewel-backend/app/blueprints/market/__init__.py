from flask import Blueprint

bp = Blueprint("market", __name__, url_prefix="/market")

from .routes import *  # noqa: E402,F401


