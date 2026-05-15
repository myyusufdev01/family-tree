from telegram.ext import ConversationHandler

# Add member states
(
    ADD_NAME,
    ADD_GENDER,
    ADD_BIRTH,
    ADD_DEATH,
    ADD_PHONE,
    ADD_NOTES,
    ADD_REL_TYPE,
    ADD_REL_TARGET,
) = range(8)

# Edit member states
(
    EDIT_SELECT,
    EDIT_FIELD,
    EDIT_VALUE,
    EDIT_REL_ACTION,
    EDIT_REL_ADD_TYPE,
    EDIT_REL_ADD_TARGET,
    EDIT_REL_REMOVE,
) = range(8, 15)

# Link relation states
(
    LINK_TYPE,
    LINK_MEMBER_A,
    LINK_MEMBER_B,
) = range(15, 18)
