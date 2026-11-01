pipeline{
    agent {label 'library'}

    tools{
        nodejs 'nodejs'
    }

    environment{
        FIMAGE_NAME = "library-frontend"
        BIMAGE_NAME = "library-backend"
    }

    stages{
        stage('Cloning the code from the github'){
            steps{
                checkout scm
            }
        }

        stage('Build the frontend'){
            steps{
                dir('client'){
                    sh 'npm install'
                }
            }
        }

        stage('Build the backend'){
            steps{
                dir('server'){
                    sh 'npm install'
                }
            }
        }

        stage('Docker build for frontend'){
            steps{
                dir('client'){
                    sh 'docker build -t ${FIMAGE_NAME}:${BUILD_NUMBER} .'
                }
            }
        }

        stage('Push frontend docker image to docker hub'){
            steps{
                withCredentials([
                  usernamePassword(
                      credentialsId : 'userlibrary',
                      usernameVariable : 'docker_user',
                      passwordVariable : 'docker_pass'
                  )
                ])
                {
                    sh '''
                    echo $docker_pass | docker login -u $docker_user --password-stdin
                    docker tag ${FIMAGE_NAME}:${BUILD_NUMBER} "$docker_user/${FIMAGE_NAME}:${BUILD_NUMBER}"
                    docker push $docker_user/${FIMAGE_NAME}:${BUILD_NUMBER}
                    '''
                }
            }
        }

        stage('Docker build for backend'){
            steps{
                dir('server'){
                    sh 'docker build -t ${BIMAGE_NAME}:${BUILD_NUMBER} . '
                }
            }
        }

        stage('Push backend docker image to docker hub'){
            steps{
                withCredentials([
                  usernamePassword(
                    credentialsId : 'userlibrary',
                    usernameVariable : 'docker_user',
                    passwordVariable : 'docker_pass'
                  )
                ])
                {
                    sh '''
                    echo $docker_pass | docker login -u $docker_user --password-stdin
                    docker tag ${BIMAGE_NAME}:${BUILD_NUMBER} "$docker_user/${BIMAGE_NAME}:${BUILD_NUMBER}"
                    docker push $docker_user/${BIMAGE_NAME}:${BUILD_NUMBER}
                    '''
                }
            }
        }

        stage('ENV file configuration'){
            steps{
                withCredentials([
                    file(credentialsId:'libraryenv',variable:'SERVER_ENV')
                ]){
                    sh 'rm -f server/.env'
                    sh 'cp "$SERVER_ENV"  server/.env'
                }
            }
        }

        stage('Deploy application'){
            steps{
                sh 'docker compose pull'
                sh 'docker compose down'
                sh 'docker compose up -d'
            }
        }
    }
}