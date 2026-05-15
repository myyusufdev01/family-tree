from telegram.ext import ConversationHandler

# Add member states
(
    ADD_NAME,
    ADD_GENDER,
    ADD_BIRTH,
    ADD_DEATH,
    ADD_PHONE,
    ADD_NOTES,
) = range(6)

# Edit member states
(
    EDIT_SELECT,
    EDIT_FIELD,
    EDIT_VALUE,
) = range(6, 9)

# Link relation states
(
    LINK_TYPE,
    LINK_MEMBER_A,
    LINK_MEMBER_B,
) = range(9, 12)
