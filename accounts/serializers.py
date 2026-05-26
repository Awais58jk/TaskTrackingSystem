import uuid

from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from .models import User


class PublicUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "role"]

    def get_name(self, obj: User) -> str:
        return obj.full_name or obj.email


class UserSerializer(PublicUserSerializer):
    is_admin = serializers.BooleanField(source="is_platform_admin", read_only=True)

    class Meta(PublicUserSerializer.Meta):
        fields = PublicUserSerializer.Meta.fields + [
            "username",
            "full_name",
            "is_admin",
            "date_joined",
            "created_at",
        ]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=160, allow_blank=False)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        username = f"{email.split('@', 1)[0]}-{uuid.uuid4().hex[:6]}"
        return User.objects.create_user(
            email=email,
            username=username,
            password=validated_data["password"],
            full_name=validated_data["full_name"],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        attrs["user"] = user
        return attrs


class UserRoleSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=User.Role.choices)
