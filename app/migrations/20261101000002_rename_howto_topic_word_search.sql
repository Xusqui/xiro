-- Migración: 20261101000002_rename_howto_topic_word_search.sql
-- Descripción: Los temas de las diapositivas de instrucciones usan la clave del tipo de pregunta
--              ('word_search'); la primera versión guardaba 'wordsearch'

UPDATE custom_game_questions SET slide_howto = 'word_search' WHERE slide_howto = 'wordsearch';
