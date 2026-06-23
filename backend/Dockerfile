FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY *.py ${LAMBDA_TASK_ROOT}/

COPY ../model/model.joblib ${LAMBDA_TASK_ROOT}/model/model.joblib
COPY ../model/model_meta.json ${LAMBDA_TASK_ROOT}/model/model_meta.json

CMD ["main.handler"]
