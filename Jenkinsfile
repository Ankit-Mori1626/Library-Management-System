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
                    sh 'docker build -t  $docker_user/${FIMAGE_NAME} .'
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
                    docker push $docker_user/${FIMAGE_NAME}
                    '''
                }
            }
        }

        stage('Docker build for backend'){
            steps{
                dir('server'){
                    sh 'docker build -t  $docker_user/${BIMAGE_NAME} . '
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
                    docker push $docker_user/${BIMAGE_NAME}
                    '''
                }
            }
        }

        stage('Deploy application'){
            steps{
                sh 'docker compose up'
            }
        }
    }
}